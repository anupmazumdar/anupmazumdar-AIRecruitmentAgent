'use strict';

const isDev = process.env.NODE_ENV !== 'production';

// ---------------------------------------------------------------------------
// 404 handler — call after all routes
// ---------------------------------------------------------------------------
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Cannot ${req.method} ${req.path}`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
    path: req.path,
  });
}

// ---------------------------------------------------------------------------
// Global error handler — must be the last app.use() call
// Express identifies error handlers by their 4-argument signature (err, req, res, next)
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
function globalErrorHandler(err, req, res, next) {
  let statusCode = err.statusCode || err.status || 500;
  let errorCode = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';

  // ---------- JWT errors ----------
  if (err.name === 'JsonWebTokenError') {
    statusCode = 403;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 403;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication token expired';

  // ---------- Validation error ----------
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = err.message;

  // ---------- Mongoose / DB CastError ----------
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = `Invalid value for field: ${err.path || 'unknown'}`;

  // ---------- Duplicate key (MongoDB code 11000) ----------
  } else if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A record with this ${field} already exists`;

  // ---------- Multer file size limit ----------
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    errorCode = 'FILE_TOO_LARGE';
    message = 'Uploaded file exceeds the allowed size limit';

  // ---------- CORS rejection ----------
  } else if (typeof message === 'string' && message.includes('not allowed by CORS')) {
    statusCode = 403;
    errorCode = 'CORS_ERROR';
    message = 'Cross-origin request blocked';
  }

  // Always log 5xx errors with full stack to server console
  if (statusCode >= 500) {
    console.error(
      `[ERROR] ${statusCode} ${req.method} ${req.path}`,
      err
    );
  }

  const payload = {
    error: errorCode,
    // Never expose internal details in production for 5xx
    message: !isDev && statusCode >= 500 ? 'Internal server error' : message,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  // Attach stack trace only in development
  if (isDev && statusCode >= 500 && err.stack) {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
}

module.exports = { globalErrorHandler, notFoundHandler };
