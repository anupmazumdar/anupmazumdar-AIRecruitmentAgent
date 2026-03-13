'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Resolve secrets — use JWT_ACCESS_SECRET if set; fall back to JWT_SECRET
// (existing tokens signed with JWT_SECRET continue to work on v1 routes)
// ---------------------------------------------------------------------------
function resolveSecrets() {
  const accessSecret =
    String(process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || '').trim();
  const refreshSecret =
    String(process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || '').trim();

  if (!accessSecret || accessSecret === 'your_secret_key_change_in_production') {
    console.warn(
      '⚠️  JWT_ACCESS_SECRET is weak or missing. Using an ephemeral process-local secret.'
    );
  }

  return {
    accessSecret: accessSecret || crypto.randomBytes(48).toString('hex'),
    refreshSecret: refreshSecret || crypto.randomBytes(48).toString('hex'),
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  };
}

const secrets = resolveSecrets();

// ---------------------------------------------------------------------------
// In-memory stores (reset on serverless cold-start — acceptable for prototype)
// ---------------------------------------------------------------------------

/** refresh token value → { userId, email, userType, issuedAt, expiresAt } */
const refreshTokenStore = new Map();

/** Set of JSON-stringified { jti, exp } for blacklisted access tokens */
const tokenBlacklist = new Set();

// Clean expired entries from blacklist every hour
const _cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const entry of tokenBlacklist) {
    try {
      const { exp } = JSON.parse(entry);
      if (now > exp * 1000) tokenBlacklist.delete(entry);
    } catch {
      tokenBlacklist.delete(entry);
    }
  }
}, 60 * 60 * 1000);

// Allow tests / Vercel to GC the interval without keeping the process alive
if (_cleanupInterval.unref) _cleanupInterval.unref();

// ---------------------------------------------------------------------------
// Token issuers
// ---------------------------------------------------------------------------

/**
 * Issue a short-lived JWT access token.
 * @param {{ userId: number|string, email: string, userType: string }} payload
 */
function issueAccessToken(payload) {
  return jwt.sign(
    { ...payload, jti: crypto.randomBytes(16).toString('hex') },
    secrets.accessSecret,
    { expiresIn: secrets.accessExpiry }
  );
}

/**
 * Issue a long-lived opaque refresh token and persist it in memory.
 * @param {{ userId: number|string, email: string, userType: string }} payload
 * @returns {string} The opaque refresh token string
 */
function issueRefreshToken(payload) {
  const token = crypto.randomBytes(64).toString('hex');
  refreshTokenStore.set(token, {
    userId: payload.userId,
    email: payload.email,
    userType: payload.userType,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  return token;
}

// ---------------------------------------------------------------------------
// Middleware: verify access token (used by v1 routes)
// Compatible with tokens issued by the existing JWT_SECRET-based login
// ---------------------------------------------------------------------------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Access token required',
    });
  }

  try {
    const decoded = jwt.verify(token, secrets.accessSecret);

    // Check token blacklist (only tokens with a jti claim can be blacklisted)
    if (decoded.jti) {
      const key = JSON.stringify({ jti: decoded.jti, exp: decoded.exp });
      if (tokenBlacklist.has(key)) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Token has been revoked',
        });
      }
    }

    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({
        error: 'TOKEN_EXPIRED',
        message: 'Access token expired. Please refresh.',
      });
    }
    return res.status(403).json({
      error: 'INVALID_TOKEN',
      message: 'Invalid or malformed token',
    });
  }
}

// ---------------------------------------------------------------------------
// RBAC middleware factory
// Usage: requireRole('recruiter') or requireRole('recruiter', 'superadmin')
// ---------------------------------------------------------------------------
function requireRole(...roles) {
  const allowed = roles.flat().map((r) => String(r).toLowerCase());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const userRole = String(
      req.user.userType || req.user.role || ''
    ).toLowerCase();

    if (!allowed.includes(userRole)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Access denied. Required role: ${allowed.join(' or ')}`,
      });
    }

    return next();
  };
}

// ---------------------------------------------------------------------------
// Route handler: POST /api/auth/refresh
// ---------------------------------------------------------------------------
async function handleRefreshToken(req, res) {
  const { refreshToken } = req.body || {};

  if (!refreshToken) {
    return res.status(400).json({
      error: 'MISSING_TOKEN',
      message: 'refreshToken is required',
    });
  }

  const stored = refreshTokenStore.get(refreshToken);

  if (!stored) {
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Invalid refresh token',
    });
  }

  if (Date.now() > stored.expiresAt) {
    refreshTokenStore.delete(refreshToken);
    return res.status(401).json({
      error: 'TOKEN_EXPIRED',
      message: 'Refresh token expired. Please log in again.',
    });
  }

  const newAccessToken = issueAccessToken({
    userId: stored.userId,
    email: stored.email,
    userType: stored.userType,
  });

  return res.json({ success: true, accessToken: newAccessToken });
}

// ---------------------------------------------------------------------------
// Route handler: POST /api/auth/logout
// ---------------------------------------------------------------------------
function handleLogout(req, res) {
  const { refreshToken } = req.body || {};
  const authHeader = req.headers['authorization'];
  const rawAccessToken = authHeader && authHeader.split(' ')[1];

  // Blacklist the current access token (if it carries a jti)
  if (rawAccessToken) {
    try {
      const decoded = jwt.decode(rawAccessToken);
      if (decoded && decoded.jti) {
        tokenBlacklist.add(
          JSON.stringify({ jti: decoded.jti, exp: decoded.exp })
        );
      }
    } catch {
      // Ignore decode failures
    }
  }

  // Revoke the refresh token
  if (refreshToken) {
    refreshTokenStore.delete(refreshToken);
  }

  return res.json({ success: true, message: 'Logged out successfully' });
}

module.exports = {
  authenticateToken,
  requireRole,
  issueAccessToken,
  issueRefreshToken,
  handleRefreshToken,
  handleLogout,
  secrets,
};
