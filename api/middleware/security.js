'use strict';

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  'https://anupmazumdar-ai-recruitment-agent.vercel.app,http://localhost:3000'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
  optionsSuccessStatus: 200,
};

// ---------------------------------------------------------------------------
// Rate limiter helpers
// ---------------------------------------------------------------------------
function makeRateLimitHandler(windowMs) {
  return (req, res) => {
    const retryAfter = Math.ceil(windowMs / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Too many requests, please slow down.',
      retryAfter,
    });
  };
}

// Global: 100 requests / 15 min
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeRateLimitHandler(15 * 60 * 1000),
});

// Auth routes (/login, /register): 5 / 15 min
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeRateLimitHandler(15 * 60 * 1000),
});

// AI routes (/evaluate/*): 20 / min
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeRateLimitHandler(60 * 1000),
});

// Admin routes: 10 / 15 min
const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeRateLimitHandler(15 * 60 * 1000),
});

// ---------------------------------------------------------------------------
// Helmet (HTTP security headers)
// ---------------------------------------------------------------------------
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: [
        "'self'",
        'https://openrouter.ai',
        'https://generativelanguage.googleapis.com',
      ],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  frameguard: { action: 'DENY' },   // X-Frame-Options: DENY
  xssFilter: true,                   // X-XSS-Protection: 1
  noSniff: true,                     // X-Content-Type-Options: nosniff
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// ---------------------------------------------------------------------------
// CORS middleware
// ---------------------------------------------------------------------------
const corsMiddleware = cors(corsOptions);

// ---------------------------------------------------------------------------
// Input sanitization array — apply with: sanitizeMiddleware.forEach(m => app.use(m))
// ---------------------------------------------------------------------------
const sanitizeMiddleware = [
  mongoSanitize(),  // strip $ and . from request body (NoSQL injection)
  xss(),            // strip XSS from all string inputs
  hpp(),            // prevent HTTP Parameter Pollution
];

module.exports = {
  helmetMiddleware,
  corsMiddleware,
  globalRateLimiter,
  authRateLimiter,
  aiRateLimiter,
  adminRateLimiter,
  sanitizeMiddleware,
};
