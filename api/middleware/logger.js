'use strict';

const winston = require('winston');
const morgan = require('morgan');

const isDev = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

// ---------------------------------------------------------------------------
// Fields that must never appear in logs
// ---------------------------------------------------------------------------
const SENSITIVE_KEYS = [
  'password',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'secret',
  'refreshtoken',
  'accesstoken',
];

function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.includes(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Winston logger
// ---------------------------------------------------------------------------
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const safeM = redact(meta);
    const metaStr =
      Object.keys(safeM).length ? ` ${JSON.stringify(safeM)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json({
    replacer: (key, value) =>
      SENSITIVE_KEYS.includes(key.toLowerCase()) ? '[REDACTED]' : value,
  })
);

const logger = winston.createLogger({
  level: logLevel,
  format: isDev ? devFormat : prodFormat,
  transports: [new winston.transports.Console()],
});

// ---------------------------------------------------------------------------
// Morgan HTTP request logger — pipes into Winston
// ---------------------------------------------------------------------------
const morganMiddleware = morgan(
  isDev ? 'dev' : 'combined',
  {
    stream: { write: (msg) => logger.http(msg.trim()) },
    // Skip health-check noise
    skip: (req) => req.path === '/api/health',
  }
);

module.exports = { logger, morganMiddleware };
