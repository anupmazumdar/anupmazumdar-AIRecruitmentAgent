// COMPLETE BACKEND SERVER - ALL FEATURES
// Includes: Auth, Subscriptions, Multi-AI, Video Analysis, Multi-format Resume Support, Google Cloud Storage
require('dotenv').config(); // Load .env variables into process.env

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const {
  evaluateResumeParsing,
  evaluateInterview,
  getModelStats: getTalentRouterModelStats,
  getCostReport: getTalentRouterCostReport,
  getABTestResults: getTalentRouterABTestResults
} = require('../talentai');

// ==================== SECURITY & MIDDLEWARE MODULES ====================
const {
  helmetMiddleware,
  corsMiddleware,
  globalRateLimiter,
  authRateLimiter,
  adminRateLimiter,
  sanitizeMiddleware,
} = require('./middleware/security');
const { morganMiddleware } = require('./middleware/logger');
const { globalErrorHandler, notFoundHandler } = require('./middleware/errorHandler');
const {
  handleRefreshToken,
  handleLogout,
  issueRefreshToken,
} = require('./middleware/auth');
const v1AiRouter = require('./routes/v1/ai');

// Lazy loaders - prevents crashes on Vercel serverless startup
function getPdf() { return require('pdf-parse'); }
function getMammoth() { return require('mammoth'); }
function getStorage() { return require('@google-cloud/storage').Storage; }

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== GOOGLE CLOUD STORAGE SETUP ====================
let storage = null;
let bucket = null;
let useGCS = false;

function initGCS() {
  if (useGCS || !process.env.GOOGLE_CLOUD_PROJECT_ID || !process.env.GOOGLE_CLOUD_BUCKET_NAME) return;
  try {
    const Storage = getStorage();
    const storageConfig = { projectId: process.env.GOOGLE_CLOUD_PROJECT_ID };
    // Only use keyFilename if it's a real file path, not set on Vercel
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.VERCEL) {
      storageConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    storage = new Storage(storageConfig);
    bucket = storage.bucket(process.env.GOOGLE_CLOUD_BUCKET_NAME);
    useGCS = true;
    console.log(`✅ Google Cloud Storage initialized: ${process.env.GOOGLE_CLOUD_BUCKET_NAME}`);
  } catch (error) {
    console.error('❌ Google Cloud Storage initialization failed:', error.message);
    useGCS = false;
  }
}

// Initialize GCS lazily only when needed (safe for serverless)
if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_BUCKET_NAME) {
  setImmediate(initGCS);
}

// ==================== DATA PERSISTENCE FUNCTIONS ====================
async function saveDataToCloud(filename, data) {
  if (!useGCS) return;

  try {
    const file = bucket.file(`data/${filename}`);
    await file.save(JSON.stringify(data, null, 2), {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache',
      }
    });
  } catch (error) {
    console.error(`Error saving ${filename} to cloud:`, error.message);
  }
}

async function loadDataFromCloud(filename, defaultValue = []) {
  if (!useGCS) return defaultValue;

  try {
    const file = bucket.file(`data/${filename}`);
    const [exists] = await file.exists();

    if (!exists) return defaultValue;

    const [contents] = await file.download();
    return JSON.parse(contents.toString());
  } catch (error) {
    console.error(`Error loading ${filename} from cloud:`, error.message);
    return defaultValue;
  }
}

async function uploadFileToCloud(localPath, cloudPath) {
  if (!useGCS) return null;

  try {
    await bucket.upload(localPath, {
      destination: cloudPath,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      }
    });

    const file = bucket.file(cloudPath);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return url;
  } catch (error) {
    console.error('Error uploading to cloud:', error.message);
    return null;
  }
}

async function getUploadedFileBuffer(file) {
  if (!file) return Buffer.from([]);
  if (file.buffer) return file.buffer;
  if (file.path) return fs.readFile(file.path);
  return Buffer.from([]);
}

async function uploadMultipartFileToCloud(file, cloudPath) {
  if (!useGCS || !file) return null;

  let tempFilePath = file.path || null;
  let cleanupTempFile = false;

  try {
    if (!tempFilePath && file.buffer) {
      tempFilePath = path.join(os.tmpdir(), `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname || '')}`);
      await fs.writeFile(tempFilePath, file.buffer);
      cleanupTempFile = true;
    }

    if (!tempFilePath) return null;
    return uploadFileToCloud(tempFilePath, cloudPath);
  } finally {
    if (cleanupTempFile && tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (error) {
        console.error('Failed to cleanup temporary upload file:', error.message);
      }
    }
  }
}

// Helper function to extract text from various document formats
// Accepts either a buffer directly (Vercel memory storage) or a file path (local disk)
async function extractTextFromDocument(filePathOrBuffer, mimeType) {
  // If it's already a buffer, use it directly; otherwise read from disk
  const buffer = Buffer.isBuffer(filePathOrBuffer)
    ? filePathOrBuffer
    : await fs.readFile(filePathOrBuffer);
  const filePath = Buffer.isBuffer(filePathOrBuffer) ? '' : filePathOrBuffer;

  try {
    if (mimeType === 'application/pdf' || filePath.endsWith('.pdf') || mimeType === 'application/pdf') {
      // PDF extraction - lazy load to avoid serverless startup crash
      const pdf = getPdf();
      const data = await pdf(buffer);
      return data.text;
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      filePath.endsWith('.docx') ||
      mimeType.includes('docx')
    ) {
      // DOCX extraction - lazy load
      const mammoth = getMammoth();
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else if (mimeType === 'application/msword' || filePath.endsWith('.doc')) {
      // DOC extraction
      const mammoth = getMammoth();
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else if (mimeType === 'text/plain' || filePath.endsWith('.txt')) {
      // TXT extraction
      return buffer.toString('utf-8');
    } else if (mimeType === 'application/rtf' || filePath.endsWith('.rtf')) {
      // RTF extraction (basic)
      return buffer.toString('utf-8').replace(/\\[a-z]+\d*\s?/g, '');
    } else {
      // Fallback - try as text
      return buffer.toString('utf-8');
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    throw new Error('Failed to extract text from document');
  }
}

// ==================== MIDDLEWARE STACK (ordered for security) ====================
// 1. Helmet — HTTP security headers
app.use(helmetMiddleware);
// 2. CORS — hardened, allowlist-based
app.use(corsMiddleware);
// 3. API version header
app.use((req, res, next) => { res.setHeader('X-API-Version', '1.0'); next(); });
// 4. Morgan HTTP logger
app.use(morganMiddleware);
// 5. Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (!process.env.VERCEL) {
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
}
// 6. Input sanitization (NoSQL injection, XSS, HPP)
sanitizeMiddleware.forEach((m) => app.use(m));
// 7. Global rate limiter (100 / 15 min)
app.use(globalRateLimiter);
// 8. Route-specific rate limiters
app.use('/api/auth', authRateLimiter);
app.use('/api/v1/auth', authRateLimiter);
app.use('/api/superadmin', adminRateLimiter);
app.use('/api/admin', adminRateLimiter);

const DEFAULT_SUPERADMIN = {
  name: process.env.SUPERADMIN_NAME || 'TalentAI Admin',
  email: (process.env.SUPERADMIN_EMAIL || 'anupmazumdar987@gmail.com').toLowerCase(),
  password: process.env.SUPERADMIN_PASSWORD || 'Anup@2610'
};

// In-memory storage (backed by cloud when available)
let users = [];
let candidates = [];
let subscriptions = [];
let questionBank = []; // Admin-managed questions
let upgradeResources = []; // Superadmin-managed YouTube/video resources by role
let chatMessages = []; // Recruiter <-> superadmin messages with hash chain integrity
let chatReadStates = []; // Per-user read checkpoints for unread counts
let authAuditLogs = []; // Auth/session security audit events
let quizSettings = {
  candidateDurationMinutes: 30,
  recruiterDurationMinutes: 30,
  updatedAt: null,
  updatedBy: null
};
let userId = 1;
let candidateId = 1;
let subscriptionId = 1;
let questionId = 1;
let upgradeResourceId = 1;
let chatMessageId = 1;

// Load data from cloud on startup
async function initializeData() {
  users = await loadDataFromCloud('users.json', []);
  candidates = await loadDataFromCloud('candidates.json', []);
  subscriptions = await loadDataFromCloud('subscriptions.json', []);
  questionBank = await loadDataFromCloud('questionBank.json', []);
  upgradeResources = await loadDataFromCloud('upgradeResources.json', []);
  chatMessages = await loadDataFromCloud('chatMessages.json', []);
  chatReadStates = await loadDataFromCloud('chatReadStates.json', []);
  authAuditLogs = await loadDataFromCloud('authAuditLogs.json', []);
  quizSettings = await loadDataFromCloud('quizSettings.json', quizSettings);

  // Set IDs to max + 1
  if (users.length > 0) userId = Math.max(...users.map(u => u.id)) + 1;
  if (candidates.length > 0) candidateId = Math.max(...candidates.map(c => c.id)) + 1;
  if (subscriptions.length > 0) subscriptionId = Math.max(...subscriptions.map(s => s.id)) + 1;
  if (questionBank.length > 0) questionId = Math.max(...questionBank.map(q => q.id)) + 1;
  if (upgradeResources.length > 0) upgradeResourceId = Math.max(...upgradeResources.map(r => r.id)) + 1;
  if (chatMessages.length > 0) chatMessageId = Math.max(...chatMessages.map(m => m.id)) + 1;

  await ensureSuperAdminAccount();

  console.log(`📊 Data loaded: ${users.length} users, ${candidates.length} candidates, ${questionBank.length} questions`);
}

let dataReadyPromise = null;

function ensureDataInitialized() {
  if (!dataReadyPromise) {
    dataReadyPromise = initializeData().catch((error) => {
      dataReadyPromise = null;
      throw error;
    });
  }

  return dataReadyPromise;
}

async function ensureSuperAdminAccount() {
  const existingAdmin = users.find(u => u.userType === 'superadmin');
  if (existingAdmin) {
    const emailChanged = existingAdmin.email !== DEFAULT_SUPERADMIN.email;
    const passwordValid = await bcrypt.compare(DEFAULT_SUPERADMIN.password, existingAdmin.password);

    if (emailChanged || !passwordValid) {
      existingAdmin.name = DEFAULT_SUPERADMIN.name;
      existingAdmin.email = DEFAULT_SUPERADMIN.email;
      existingAdmin.password = await bcrypt.hash(DEFAULT_SUPERADMIN.password, 10);
      existingAdmin.updatedAt = new Date().toISOString();
      await saveUsers();
      console.log(`🔐 Updated superadmin account: ${DEFAULT_SUPERADMIN.email}`);
    }

    return;
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_SUPERADMIN.password, 10);
  users.push({
    id: userId++,
    name: DEFAULT_SUPERADMIN.name,
    email: DEFAULT_SUPERADMIN.email,
    password: hashedPassword,
    userType: 'superadmin',
    company: 'TalentAI',
    createdAt: new Date().toISOString()
  });

  await saveUsers();
  console.log(`🔐 Seeded superadmin account: ${DEFAULT_SUPERADMIN.email}`);
}

// Auto-save functions
async function saveUsers() {
  await saveDataToCloud('users.json', users);
}

async function saveCandidates() {
  await saveDataToCloud('candidates.json', candidates);
}

async function saveSubscriptions() {
  await saveDataToCloud('subscriptions.json', subscriptions);
}

async function saveQuestionBank() {
  await saveDataToCloud('questionBank.json', questionBank);
}

async function saveUpgradeResources() {
  await saveDataToCloud('upgradeResources.json', upgradeResources);
}

async function saveChatMessages() {
  await saveDataToCloud('chatMessages.json', chatMessages);
}

async function saveChatReadStates() {
  await saveDataToCloud('chatReadStates.json', chatReadStates);
}

async function saveAuthAuditLogs() {
  await saveDataToCloud('authAuditLogs.json', authAuditLogs.slice(-5000));
}

async function saveQuizSettings() {
  await saveDataToCloud('quizSettings.json', quizSettings);
}

app.use(async (req, res, next) => {
  try {
    const initTimeoutMs = Math.max(1000, Number(process.env.DATA_INIT_TIMEOUT_MS || 4000));
    await Promise.race([
      ensureDataInitialized(),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Data initialization timed out after ${initTimeoutMs}ms`)), initTimeoutMs))
    ]);
    next();
  } catch (error) {
    console.error('Initialization error:', error);
    res.status(503).json({ error: 'Server initialization failed' });
  }
});

function resolveJwtSecret() {
  const configured = String(process.env.JWT_SECRET || '').trim();
  if (configured && configured !== 'your_secret_key_change_in_production') return configured;

  // Keep the server running with a process-local fallback secret while signaling misconfiguration.
  console.warn('⚠️ JWT_SECRET is missing or using a weak default. Using an ephemeral secret for this process.');
  return crypto.randomBytes(48).toString('hex');
}

const JWT_SECRET = resolveJwtSecret();
const AUTH0_DOMAIN = String(process.env.AUTH0_DOMAIN || process.env.REACT_APP_AUTH0_DOMAIN || 'dev-shjk32vx4oscfrde.us.auth0.com').trim();
const AUTH0_CLIENT_ID = String(process.env.AUTH0_CLIENT_ID || process.env.REACT_APP_AUTH0_CLIENT_ID || 'KHC4ncaBYv0W4NqgVSLD5vJI8SuqPHDk').trim();
const AUTH0_ALLOWED_RECRUITER_DOMAINS = String(process.env.AUTH0_ALLOWED_RECRUITER_DOMAINS || '')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const auth0Issuer = AUTH0_DOMAIN ? `https://${AUTH0_DOMAIN}/` : '';
const auth0JwksClient = AUTH0_DOMAIN
  ? jwksClient({
      jwksUri: `${auth0Issuer}.well-known/jwks.json`,
      cache: true,
      cacheMaxEntries: 10,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 10
    })
  : null;

function getAuth0SigningKey(kid) {
  if (!auth0JwksClient) {
    return Promise.reject(new Error('Auth0 is not configured'));
  }

  return new Promise((resolve, reject) => {
    auth0JwksClient.getSigningKey(kid, (error, key) => {
      if (error) return reject(error);
      const signingKey = key?.getPublicKey?.() || key?.publicKey || key?.rsaPublicKey;
      if (!signingKey) return reject(new Error('Unable to resolve signing key'));
      resolve(signingKey);
    });
  });
}

async function verifyAuth0IdToken(idToken) {
  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) {
    throw new Error('Auth0 domain/client id not configured');
  }

  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded?.header?.kid;
  if (!kid) {
    throw new Error('Invalid Auth0 token header');
  }

  const signingKey = await getAuth0SigningKey(kid);
  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      signingKey,
      {
        algorithms: ['RS256'],
        issuer: auth0Issuer,
        audience: AUTH0_CLIENT_ID
      },
      (error, payload) => {
        if (error) return reject(error);
        resolve(payload);
      }
    );
  });
}

function getEmailDomain(email) {
  const normalized = String(email || '').toLowerCase();
  const parts = normalized.split('@');
  return parts.length === 2 ? parts[1] : '';
}

function isRecruiterDomainAllowed(email) {
  if (!AUTH0_ALLOWED_RECRUITER_DOMAINS.length) {
    return false;
  }

  const domain = getEmailDomain(email);
  return domain ? AUTH0_ALLOWED_RECRUITER_DOMAINS.includes(domain) : false;
}

async function writeAuthAuditLog(eventType, req, details = {}) {
  const entry = {
    id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    eventType,
    ip: req.headers['x-forwarded-for'] || req.ip || null,
    userAgent: req.headers['user-agent'] || null,
    timestamp: new Date().toISOString(),
    ...details
  };

  authAuditLogs.push(entry);
  if (authAuditLogs.length > 5000) {
    authAuditLogs = authAuditLogs.slice(-5000);
  }

  const auditPersistTimeoutMs = Math.max(500, Number(process.env.AUTH_AUDIT_SAVE_TIMEOUT_MS || 1200));
  try {
    await Promise.race([
      saveAuthAuditLogs(),
      new Promise((resolve) => setTimeout(resolve, auditPersistTimeoutMs))
    ]);
  } catch (error) {
    console.error('Auth audit persistence warning:', error.message || error);
  }

  return entry;
}

// File upload configuration
// On Vercel: use memory storage (no disk write access and no persistent filesystem)
// Locally: use disk storage
const multerStorage = process.env.VERCEL
  ? multer.memoryStorage()
  : multer.diskStorage({
    destination: async (req, file, cb) => {
      const baseDir = './uploads';
      const uploadDir = file.fieldname === 'video' ? path.join(baseDir, 'videos') : baseDir;
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error) {
        cb(error);
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB local limit
});

// ==================== AI SERVICE ====================
const AI_REQUEST_TIMEOUT_MS = Math.max(3000, Number(process.env.AI_REQUEST_TIMEOUT_MS || 25000));

function sanitizeModelName(value, fallback) {
  const candidate = String(value || '').trim();
  if (!candidate) return fallback;
  // Restrict model identifiers to provider-safe characters.
  return /^[a-zA-Z0-9._:/-]+$/.test(candidate) ? candidate : fallback;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getModelOverridesByTask(task = 'general') {
  const taskKey = String(task || 'general').toLowerCase();
  const keySuffix = taskKey.toUpperCase();

  const getEnv = (name, fallback = '') => String(process.env[name] || fallback || '').trim();

  return {
    openrouter: getEnv(`OPENROUTER_MODEL_${keySuffix}`, getEnv('OPENROUTER_MODEL')),
    gemini: getEnv(`GOOGLE_GEMINI_MODEL_${keySuffix}`, getEnv('GOOGLE_GEMINI_MODEL', 'gemini-pro')),
    openai: getEnv(`OPENAI_MODEL_${keySuffix}`, getEnv('OPENAI_MODEL', 'gpt-3.5-turbo')),
    claude: getEnv(`ANTHROPIC_MODEL_${keySuffix}`, getEnv('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514'))
  };
}

async function callAI(prompt, systemPrompt = "", options = {}) {
  const task = options.task || 'general';
  const modelOverrides = getModelOverridesByTask(task);

  // Priority: OpenRouter > env-specified provider > Gemini > OpenAI > Claude
  // OpenRouter key takes top priority — it supports 100+ models via one key
  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await callOpenRouter(prompt, systemPrompt, { model: modelOverrides.openrouter });
    } catch (err) {
      console.error('OpenRouter error, trying next provider:', err.message);
    }
  }

  const provider = process.env.AI_PROVIDER || 'gemini';
  try {
    switch (provider) {
      case 'gemini': return await callGemini(prompt, systemPrompt, { model: modelOverrides.gemini });
      case 'openai': return await callOpenAI(prompt, systemPrompt, { model: modelOverrides.openai });
      case 'claude': return await callClaude(prompt, systemPrompt, { model: modelOverrides.claude });
      default:       return await callGemini(prompt, systemPrompt, { model: modelOverrides.gemini });
    }
  } catch (error) {
    console.error(`AI Error (${provider}):`, error.message);
    if (provider !== 'gemini') {
      console.log('Falling back to Gemini...');
      return await callGemini(prompt, systemPrompt, { model: modelOverrides.gemini });
    }
    throw error;
  }
}

// ── OpenRouter (OpenAI-compatible, 100+ models, free tier available) ──────────
async function callOpenRouter(prompt, systemPrompt = "", options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OpenRouter API key not configured');

  // Default to a free/cheap model — override via OPENROUTER_MODEL env var
  // Free models: mistralai/mistral-7b-instruct, google/gemma-3-27b-it:free, meta-llama/llama-3.1-8b-instruct:free
  const model = sanitizeModelName(options.model || process.env.OPENROUTER_MODEL, 'mistralai/mistral-7b-instruct:free');

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000',  // Required by OpenRouter
      'X-Title': 'TalentAI Recruitment'          // Shown in OpenRouter dashboard
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 8000
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `OpenRouter API error: ${response.status}`);

  return data.choices[0]?.message?.content || '';
}

async function callGemini(prompt, systemPrompt = "", options = {}) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Google Gemini API key not configured');
  const model = sanitizeModelName(options.model || process.env.GOOGLE_GEMINI_MODEL, 'gemini-pro');

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Gemini API error');

  return data.candidates[0]?.content?.parts[0]?.text || '';
}

async function callOpenAI(prompt, systemPrompt = "", options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');
  const model = sanitizeModelName(options.model || process.env.OPENAI_MODEL, 'gpt-3.5-turbo');

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2048
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'OpenAI API error');

  return data.choices[0]?.message?.content || '';
}

async function callClaude(prompt, systemPrompt = "", options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic API key not configured');
  const model = sanitizeModelName(options.model || process.env.ANTHROPIC_MODEL, 'claude-sonnet-4-20250514');

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Claude API error');

  return data.content.find(item => item.type === 'text')?.text || '';
}

function clampScore(value, min = 0, max = 100, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function extractJsonPayload(raw = '', expect = 'object') {
  const text = String(raw || '').replace(/```json|```/gi, '').trim();
  if (!text) return '';

  const pattern = expect === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const match = text.match(pattern);
  return (match ? match[0] : text).trim();
}

function parseJsonFromAI(raw = '', expect = 'object') {
  const payload = extractJsonPayload(raw, expect);
  const parsed = JSON.parse(payload);

  if (expect === 'array' && !Array.isArray(parsed)) {
    throw new Error('AI output is not a JSON array');
  }
  if (expect === 'object' && (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null)) {
    throw new Error('AI output is not a JSON object');
  }

  return parsed;
}

const RESUME_TECH_KEYWORDS = [
  'javascript', 'typescript', 'node', 'react', 'angular', 'vue', 'python', 'java', 'spring', 'django',
  'flask', 'go', 'rust', 'c++', 'c#', 'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'sql', 'mongodb',
  'redis', 'tensorflow', 'pytorch', 'machine learning', 'data analysis'
];

function extractResumeSignals(resumeText = '') {
  const text = String(resumeText || '');
  const lower = text.toLowerCase();

  const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const phoneMatches = text.match(/(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)?\d{3}[\s-]?\d{4}/g) || [];
  const projectMentions = (lower.match(/\b(project|built|developed|implemented|designed|shipped)\b/g) || []).length;

  const detectedTech = RESUME_TECH_KEYWORDS.filter(keyword => lower.includes(keyword));

  return {
    emails: [...new Set(emailMatches)].slice(0, 3),
    phones: [...new Set(phoneMatches)].slice(0, 3),
    projectMentions,
    technologies: detectedTech.slice(0, 8)
  };
}

function normalizeResumeAnalysis(parsed = {}, resumeText = '') {
  const signals = extractResumeSignals(resumeText);
  const data = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};

  const toStringArray = (value, fallback = []) => {
    if (!Array.isArray(value)) return fallback;
    return value
      .map(v => String(v || '').trim())
      .filter(Boolean);
  };

  const projects = Array.isArray(data.projects)
    ? data.projects
      .filter(p => p && typeof p === 'object')
      .map((project, idx) => ({
        name: String(project.name || `Project ${idx + 1}`).trim(),
        description: String(project.description || 'Project details were partially extracted from resume.').trim(),
        technologies: toStringArray(project.technologies, signals.technologies.slice(0, 4)),
        impact: String(project.impact || 'Impact details not clearly specified.').trim()
      }))
    : [];

  const atsScore = clampScore(data.atsScore, 0, 100, 75);
  const projectScoreFallback = signals.projectMentions > 0 ? 78 : 60;
  const projectScore = clampScore(data.projectScore, 0, 100, projectScoreFallback);

  const strengths = toStringArray(data.strengths, [
    'Resume follows a generally professional structure',
    'Relevant skills are present for the target role'
  ]).slice(0, 6);

  const improvements = toStringArray(data.improvements, [
    'Add measurable outcomes for projects and work experience',
    'Improve ATS keyword alignment with the job description',
    'Use cleaner section headings and consistent formatting'
  ]).slice(0, 6);

  const projectAnalysis = String(data.projectAnalysis || (
    projects.length > 0
      ? 'Projects were detected and normalized through validation checks.'
      : 'Limited project evidence found. Add concrete hands-on projects with impact metrics.'
  )).trim();

  return {
    atsScore,
    projectScore,
    projects,
    strengths,
    improvements,
    projectAnalysis,
    extractedSignals: signals
  };
}

// ==================== AUTHENTICATION MIDDLEWARE ====================
function hasPlatformAccess(user = null) {
  return !user || user.canAccessPlatform !== false;
}

function sanitizeManagedUser(user = {}) {
  const { password: _, ...safe } = user;
  return {
    ...safe,
    canAccessPlatform: hasPlatformAccess(user)
  };
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const currentUser = users.find(u => u.id === decoded.userId || u.email === decoded.email);
    if (!currentUser || !hasPlatformAccess(currentUser)) {
      return res.status(403).json({ error: 'Access revoked by admin' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function requireSuperAdmin(req, res, next) {
  if (req.user?.userType !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' });
  }

  next();
}

function getCurrentUserFromRequest(req) {
  return users.find((user) => user.id === req.user?.userId || user.email === req.user?.email) || null;
}

function buildChatConversationId(userA, userB) {
  return [Number(userA.id), Number(userB.id)].sort((a, b) => a - b).join(':');
}

function getConversationMessages(conversationId) {
  return chatMessages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => Number(a.blockIndex) - Number(b.blockIndex) || Number(a.id) - Number(b.id));
}

function getConversationReadState(conversationId, userId) {
  return chatReadStates.find((item) => item.conversationId === conversationId && Number(item.userId) === Number(userId)) || null;
}

function getConversationLastReadBlockIndex(conversationId, userId) {
  return Number(getConversationReadState(conversationId, userId)?.lastReadBlockIndex) || 0;
}

async function markConversationRead(conversationId, userId, lastReadBlockIndex) {
  const nextIndex = Number(lastReadBlockIndex) || 0;
  const existing = getConversationReadState(conversationId, userId);

  if (existing) {
    if (Number(existing.lastReadBlockIndex) >= nextIndex) {
      return existing;
    }

    existing.lastReadBlockIndex = nextIndex;
    existing.lastReadAt = new Date().toISOString();
    await saveChatReadStates();
    return existing;
  }

  const state = {
    conversationId,
    userId: Number(userId),
    lastReadBlockIndex: nextIndex,
    lastReadAt: new Date().toISOString()
  };
  chatReadStates.push(state);
  await saveChatReadStates();
  return state;
}

function sanitizeChatAttachment(attachment) {
  if (!attachment) return null;

  return {
    kind: attachment.kind,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    storagePath: attachment.storagePath,
    fileHash: attachment.fileHash,
    url: attachment.url || (attachment.storagePath ? `/${String(attachment.storagePath).replace(/^\/+/, '')}` : null)
  };
}

function buildChatAttachmentPreview(message) {
  if (!message) return '';
  if (message.text) return String(message.text).slice(0, 80);
  if (message.attachment?.fileName) return `Attachment: ${message.attachment.fileName}`;
  return 'Secure message';
}

async function buildChatAttachment(file, conversationId) {
  if (!file) return null;

  const buffer = await getUploadedFileBuffer(file);
  const safeFileName = String(file.originalname || 'attachment')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
  const storagePath = useGCS
    ? `chat-attachments/${conversationId}/${Date.now()}-${safeFileName}`
    : String(file.path || '').replace(/\\/g, '/').replace(/^\.?\//, '');
  const attachment = {
    kind: String(file.mimetype || '').startsWith('image/') ? 'image' : 'file',
    fileName: safeFileName,
    mimeType: file.mimetype || 'application/octet-stream',
    size: Number(file.size) || buffer.length,
    storagePath,
    fileHash: crypto.createHash('sha256').update(buffer).digest('hex'),
    url: null
  };

  try {
    if (useGCS) {
      attachment.url = await uploadMultipartFileToCloud(file, storagePath);
    } else if (storagePath) {
      attachment.url = `/${storagePath}`;
    }
  } finally {
    if (useGCS && file.path) {
      try {
        await fs.unlink(file.path);
      } catch (error) {
        console.error('Failed to cleanup uploaded attachment file:', error.message);
      }
    }
  }

  return attachment;
}

function buildChatHashPayload(message) {
  return JSON.stringify({
    id: message.id,
    conversationId: message.conversationId,
    blockIndex: message.blockIndex,
    previousHash: message.previousHash,
    senderId: message.senderId,
    senderType: message.senderType,
    receiverId: message.receiverId,
    receiverType: message.receiverType,
    text: message.text,
    attachment: message.attachment ? {
      kind: message.attachment.kind,
      fileName: message.attachment.fileName,
      mimeType: message.attachment.mimeType,
      size: message.attachment.size,
      storagePath: message.attachment.storagePath,
      fileHash: message.attachment.fileHash
    } : null,
    createdAt: message.createdAt
  });
}

function computeChatHash(message) {
  return crypto.createHash('sha256').update(buildChatHashPayload(message)).digest('hex');
}

function verifyConversationIntegrity(messages = []) {
  const ordered = [...messages].sort((a, b) => Number(a.blockIndex) - Number(b.blockIndex) || Number(a.id) - Number(b.id));
  let previousHash = 'GENESIS';

  for (let index = 0; index < ordered.length; index += 1) {
    const message = ordered[index];
    const expectedIndex = index + 1;
    const expectedHash = computeChatHash(message);
    if (Number(message.blockIndex) !== expectedIndex || message.previousHash !== previousHash || message.hash !== expectedHash) {
      return {
        valid: false,
        checkedBlocks: ordered.length,
        brokenAtId: message.id,
        lastValidHash: previousHash
      };
    }
    previousHash = message.hash;
  }

  return {
    valid: true,
    checkedBlocks: ordered.length,
    brokenAtId: null,
    lastValidHash: previousHash
  };
}

function sanitizeChatMessage(message) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    blockIndex: message.blockIndex,
    previousHash: message.previousHash,
    hash: message.hash,
    senderId: message.senderId,
    senderType: message.senderType,
    receiverId: message.receiverId,
    receiverType: message.receiverType,
    text: message.text,
    attachment: sanitizeChatAttachment(message.attachment),
    createdAt: message.createdAt
  };
}

function validateChatParticipants(currentUser, peerUser) {
  if (!currentUser || !peerUser) {
    return { valid: false, error: 'Chat participant not found', status: 404 };
  }

  const allowedUserTypes = ['recruiter', 'superadmin'];
  if (!allowedUserTypes.includes(currentUser.userType) || !allowedUserTypes.includes(peerUser.userType)) {
    return { valid: false, error: 'Only recruiter and superadmin chat is supported', status: 403 };
  }

  const pair = [currentUser.userType, peerUser.userType].sort().join(':');
  if (pair !== 'recruiter:superadmin') {
    return { valid: false, error: 'Only recruiter and superadmin can chat with each other', status: 403 };
  }

  return { valid: true };
}

function createChatMessage(sender, receiver, text, attachment = null) {
  const conversationId = buildChatConversationId(sender, receiver);
  const existingMessages = getConversationMessages(conversationId);
  const previousHash = existingMessages.length ? existingMessages[existingMessages.length - 1].hash : 'GENESIS';
  const message = {
    id: chatMessageId++,
    conversationId,
    blockIndex: existingMessages.length + 1,
    previousHash,
    senderId: sender.id,
    senderType: sender.userType,
    receiverId: receiver.id,
    receiverType: receiver.userType,
    text: String(text || '').trim(),
    attachment: attachment ? sanitizeChatAttachment(attachment) : null,
    createdAt: new Date().toISOString()
  };
  message.hash = computeChatHash(message);
  return message;
}

// ==================== AUTHENTICATION ROUTES ====================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, userType, company } = req.body;
    const normalizedUserType = String(userType || '').toLowerCase();

    if (!email || !password || !normalizedUserType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['candidate', 'recruiter'].includes(normalizedUserType)) {
      return res.status(400).json({ error: 'Invalid user type' });
    }

    const normalizedName = String(name || '').trim() || (normalizedUserType === 'candidate' ? email.split('@')[0] : '');
    const normalizedCompany = String(company || '').trim();

    if (normalizedUserType === 'recruiter' && !normalizedName) {
      return res.status(400).json({ error: 'Recruiter name is required' });
    }

    if (normalizedUserType === 'recruiter' && !normalizedCompany) {
      return res.status(400).json({ error: 'Company is required for recruiter accounts' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = {
      id: userId++,
      name: normalizedName,
      email: email.toLowerCase(),
      password: hashedPassword,
      userType: normalizedUserType,
      canAccessPlatform: true,
      company: normalizedUserType === 'recruiter' ? normalizedCompany : null,
      createdAt: new Date().toISOString()
    };

    users.push(user);
    await saveUsers(); // Save to cloud

    const token = jwt.sign(
      { userId: user.id, email: user.email, userType: user.userType },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const refreshToken = issueRefreshToken({ userId: user.id, email: user.email, userType: user.userType });
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      success: true,
      user: userWithoutPassword,
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!hasPlatformAccess(user)) {
      return res.status(403).json({ error: 'Access revoked by admin' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, userType: user.userType },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const refreshToken = issueRefreshToken({ userId: user.id, email: user.email, userType: user.userType });
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      user: userWithoutPassword,
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Auth0 ID token exchange: validates Auth0 identity and issues existing TalentAI JWT tokens.
app.post('/api/auth/auth0/session', async (req, res) => {
  try {
    const accessToken = String(req.body?.accessToken || '').trim();
    const requestedUserType = String(req.body?.userType || '').trim().toLowerCase();
    const requestedCompany = String(req.body?.company || '').trim();

    if (!accessToken) {
      await writeAuthAuditLog('auth0_session_denied', req, {
        reason: 'missing_access_token'
      });
      return res.status(400).json({ error: 'accessToken is required' });
    }

    if (requestedUserType && !['candidate', 'recruiter'].includes(requestedUserType)) {
      await writeAuthAuditLog('auth0_session_denied', req, {
        reason: 'invalid_user_type',
        requestedUserType
      });
      return res.status(400).json({ error: 'Invalid userType' });
    }

    // Verify the access token by calling Auth0's /userinfo endpoint with a strict timeout
    // so serverless invocations cannot hang until platform timeout.
    const userInfoUrl = `https://${AUTH0_DOMAIN}/userinfo`;
    const userInfoTimeoutMs = Math.max(1000, Number(process.env.AUTH0_USERINFO_TIMEOUT_MS || 4500));
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutHandle = setTimeout(() => {
      if (controller) controller.abort();
    }, userInfoTimeoutMs);

    let userInfoRes;
    try {
      if (typeof fetch !== 'function') {
        throw new Error('Global fetch is unavailable in this runtime');
      }
      userInfoRes = await fetch(userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller ? controller.signal : undefined
      });
    } catch (requestError) {
      const requestMessage = requestError?.name === 'AbortError'
        ? `Auth0 userinfo request timed out after ${userInfoTimeoutMs}ms`
        : `Auth0 userinfo request failed: ${requestError?.message || 'unknown error'}`;
      throw new Error(requestMessage);
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!userInfoRes.ok) {
      const errBody = await userInfoRes.text().catch(() => '');
      throw new Error(`Auth0 userinfo rejected (${userInfoRes.status}): ${errBody.slice(0, 120)}`);
    }
    const auth0Payload = await userInfoRes.json();
    const email = String(auth0Payload?.email || '').trim().toLowerCase();
    const auth0Sub = String(auth0Payload?.sub || '').trim();
    const name = String(auth0Payload?.name || auth0Payload?.nickname || email.split('@')[0] || '').trim();

    if (!email || !auth0Sub) {
      await writeAuthAuditLog('auth0_session_denied', req, {
        reason: 'missing_identity_claims',
        email,
        auth0Sub
      });
      return res.status(400).json({ error: 'Auth0 token does not contain required identity claims' });
    }

    let user = users.find((entry) => entry.auth0Sub === auth0Sub || String(entry.email || '').toLowerCase() === email);
    const isFirstTimeAuth0User = !user;

    if (isFirstTimeAuth0User) {
      if (!requestedUserType) {
        await writeAuthAuditLog('auth0_session_denied', req, {
          reason: 'missing_first_time_role',
          email,
          auth0Sub
        });
        return res.status(400).json({ error: 'Role selection is required for first-time Auth0 sign in' });
      }

      const userType = requestedUserType;
      if (userType === 'recruiter' && !requestedCompany) {
        await writeAuthAuditLog('auth0_session_denied', req, {
          reason: 'missing_recruiter_company',
          email,
          auth0Sub,
          requestedUserType
        });
        return res.status(400).json({ error: 'Company is required for new recruiter accounts' });
      }

      if (userType === 'recruiter' && !isRecruiterDomainAllowed(email)) {
        await writeAuthAuditLog('auth0_session_denied', req, {
          reason: 'recruiter_domain_not_allowed',
          email,
          auth0Sub,
          requestedUserType,
          emailDomain: getEmailDomain(email),
          allowedDomains: AUTH0_ALLOWED_RECRUITER_DOMAINS
        });
        return res.status(403).json({ error: 'Recruiter accounts are restricted to approved company domains' });
      }

      const randomPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = {
        id: userId++,
        name: name || email.split('@')[0],
        email,
        password: hashedPassword,
        userType,
        canAccessPlatform: true,
        company: userType === 'recruiter' ? requestedCompany : null,
        authProvider: 'auth0',
        auth0Sub,
        emailVerified: auth0Payload?.email_verified !== false,
        createdAt: new Date().toISOString(),
        lastAuth0LoginAt: new Date().toISOString()
      };

      users.push(user);
      await saveUsers();

      await writeAuthAuditLog('auth0_user_created', req, {
        email,
        auth0Sub,
        userId: user.id,
        userType: user.userType,
        company: user.company || null,
        isFirstTimeAuth0User: true
      });
    } else {
      let changed = false;
      if (user.auth0Sub !== auth0Sub) {
        user.auth0Sub = auth0Sub;
        changed = true;
      }
      if (name && user.name !== name) {
        user.name = name;
        changed = true;
      }
      if (user.authProvider !== 'auth0') {
        user.authProvider = 'auth0';
        changed = true;
      }
      if (typeof auth0Payload?.email_verified === 'boolean' && user.emailVerified !== auth0Payload.email_verified) {
        user.emailVerified = auth0Payload.email_verified;
        changed = true;
      }
      user.lastAuth0LoginAt = new Date().toISOString();
      changed = true;

      if (changed) {
        await saveUsers();
      }

      await writeAuthAuditLog('auth0_user_login', req, {
        email,
        auth0Sub,
        userId: user.id,
        userType: user.userType,
        company: user.company || null,
        isFirstTimeAuth0User: false
      });
    }

    if (!hasPlatformAccess(user)) {
      await writeAuthAuditLog('auth0_session_denied', req, {
        reason: 'platform_access_revoked',
        email,
        auth0Sub,
        userId: user.id,
        userType: user.userType
      });
      return res.status(403).json({ error: 'Access revoked by admin' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, userType: user.userType },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const refreshToken = issueRefreshToken({ userId: user.id, email: user.email, userType: user.userType });
    const { password: _, ...userWithoutPassword } = user;

    await writeAuthAuditLog('auth0_session_issued', req, {
      email,
      auth0Sub,
      userId: user.id,
      userType: user.userType,
      company: user.company || null,
      isFirstTimeAuth0User
    });

    return res.json({
      success: true,
      user: userWithoutPassword,
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Auth0 session exchange error:', error.message);
    try {
      await writeAuthAuditLog('auth0_session_denied', req, {
        reason: 'invalid_auth0_token',
        details: error.message
      });
    } catch (_) { /* audit log failure must not hide the original error */ }
    return res.status(401).json({ error: 'Invalid Auth0 token' });
  }
});

// ==================== SUBSCRIPTION ROUTES ====================

// Create subscription
app.post('/api/subscriptions', authenticateToken, async (req, res) => {
  try {
    const { userId, planKey, billingCycle, amount } = req.body;

    const subscription = {
      id: subscriptionId++,
      userId,
      planKey,
      billingCycle,
      amount,
      status: 'active',
      startDate: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    subscriptions.push(subscription);
    await saveSubscriptions(); // Save to cloud

    res.status(201).json({
      success: true,
      subscription
    });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== CANDIDATE ROUTES ====================

// ==================== ADMIN QUESTION BANK ROUTES ====================

// GET all questions (optionally filter by position)
app.get('/api/admin/questions', authenticateToken, (req, res) => {
  if (!['recruiter', 'superadmin'].includes(req.user?.userType)) {
    return res.status(403).json({ error: 'Recruiter or superadmin access required' });
  }

  const { position } = req.query;
  const filtered = position
    ? questionBank.filter(q => q.position.toLowerCase() === position.toLowerCase())
    : questionBank;
  res.json({ success: true, questions: filtered, quizSettings });
});

// GET all unique positions that have questions
app.get('/api/admin/positions', authenticateToken, (req, res) => {
  if (!['recruiter', 'superadmin'].includes(req.user?.userType)) {
    return res.status(403).json({ error: 'Recruiter or superadmin access required' });
  }

  const positions = [...new Set(questionBank.map(q => q.position))];
  res.json({ success: true, positions });
});

// POST create is disabled: questions can be modified or AI-refreshed only
app.post('/api/admin/questions', authenticateToken, async (req, res) => {
  return res.status(405).json({
    error: 'Question creation disabled',
    message: 'Questions can only be modified or AI-refreshed. Adding extra questions is disabled.'
  });
});

// PUT update an existing question
app.put('/api/admin/questions/:id', authenticateToken, async (req, res) => {
  try {
    if (!['recruiter', 'superadmin'].includes(req.user?.userType)) {
      return res.status(403).json({ error: 'Recruiter or superadmin access required' });
    }

    const id = parseInt(req.params.id);
    const idx = questionBank.findIndex(q => q.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Question not found' });
    const { position, question, options, correctAnswer } = req.body;
    questionBank[idx] = { ...questionBank[idx], position, question, options, correctAnswer: parseInt(correctAnswer), updatedAt: new Date().toISOString() };
    await saveQuestionBank();
    res.json({ success: true, question: questionBank[idx] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// DELETE a question
app.delete('/api/admin/questions/:id', authenticateToken, async (req, res) => {
  return res.status(405).json({
    error: 'Question deletion disabled',
    message: 'Questions can only be modified or AI-refreshed.'
  });
});

// PUT refresh question bank for a position using AI while keeping count fixed
app.put('/api/admin/questions/refresh/:position', authenticateToken, async (req, res) => {
  try {
    if (!['recruiter', 'superadmin'].includes(req.user?.userType)) {
      return res.status(403).json({ error: 'Recruiter or superadmin access required' });
    }

    const position = decodeURIComponent(String(req.params.position || '')).trim();
    const existing = questionBank.filter(q => q.position.toLowerCase() === position.toLowerCase());
    if (existing.length === 0) {
      return res.status(404).json({ error: 'No existing questions for this position to refresh' });
    }

    const count = existing.length;
    const hasApiKey = process.env.OPENROUTER_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!hasApiKey) {
      return res.status(400).json({ error: 'AI key not configured for question refresh' });
    }

    const prompt = `Generate exactly ${count} fresh technical MCQ questions for ${position}.
Return ONLY JSON array:
[{
  "question": "string",
  "options": ["A","B","C","D"],
  "correctAnswer": 0
}]`;
    const systemPrompt = 'You are a strict assessment generator. Return valid JSON only.';

    const raw = await callAI(prompt, systemPrompt, { task: 'quiz' });
    const generated = parseJsonFromAI(raw, 'array').slice(0, count);

    if (!generated.length) {
      return res.status(500).json({ error: 'Failed to generate refreshed questions' });
    }

    const next = generated.map((q, i) => ({
      id: existing[i]?.id || questionId++,
      position,
      question: String(q.question || '').trim(),
      options: Array.isArray(q.options) ? q.options.slice(0, 4).map(o => String(o || '').trim()) : [],
      correctAnswer: Number.isFinite(Number(q.correctAnswer)) ? Number(q.correctAnswer) : 0,
      createdAt: existing[i]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    questionBank = [
      ...questionBank.filter(q => q.position.toLowerCase() !== position.toLowerCase()),
      ...next
    ];

    await saveQuestionBank();
    return res.json({ success: true, refreshedCount: next.length, questions: next });
  } catch (error) {
    console.error('Question refresh error:', error.message);
    return res.status(500).json({ error: 'Failed to refresh questions' });
  }
});

// Quiz duration settings for candidate/recruiter (minutes)
app.get('/api/quiz/settings', authenticateToken, (req, res) => {
  if (!['candidate', 'recruiter', 'superadmin'].includes(req.user?.userType)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  return res.json({ success: true, settings: quizSettings });
});

app.put('/api/quiz/settings', authenticateToken, async (req, res) => {
  try {
    if (!['recruiter', 'superadmin'].includes(req.user?.userType)) {
      return res.status(403).json({ error: 'Recruiter or superadmin access required' });
    }

    const candidateDurationMinutes = clampScore(req.body?.candidateDurationMinutes, 5, 180, quizSettings.candidateDurationMinutes || 30);
    const recruiterDurationMinutes = clampScore(req.body?.recruiterDurationMinutes, 5, 180, quizSettings.recruiterDurationMinutes || 30);

    quizSettings = {
      candidateDurationMinutes,
      recruiterDurationMinutes,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.email || 'unknown'
    };

    await saveQuizSettings();
    return res.json({ success: true, settings: quizSettings });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update quiz settings' });
  }
});

// ==================== BLOCKCHAIN-SECURED CHAT ROUTES ====================

app.get('/api/chat/contacts', authenticateToken, (req, res) => {
  const currentUser = getCurrentUserFromRequest(req);
  if (!currentUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (currentUser.userType === 'recruiter') {
    const superadmins = users
      .filter((user) => user.userType === 'superadmin')
      .map((user) => {
        const conversationId = buildChatConversationId(currentUser, user);
        const conversationMessages = getConversationMessages(conversationId);
        const lastMessage = conversationMessages[conversationMessages.length - 1] || null;
        const unreadCount = conversationMessages.filter((message) => Number(message.receiverId) === Number(currentUser.id) && Number(message.blockIndex) > getConversationLastReadBlockIndex(conversationId, currentUser.id)).length;

        return {
          ...sanitizeManagedUser(user),
          conversationId,
          unreadCount,
          lastMessageAt: lastMessage?.createdAt || null,
          lastMessagePreview: buildChatAttachmentPreview(lastMessage),
          lastMessageHasAttachment: Boolean(lastMessage?.attachment)
        };
      })
      .sort((a, b) => String(b.lastMessageAt || '').localeCompare(String(a.lastMessageAt || '')) || String(a.name || '').localeCompare(String(b.name || '')));
    return res.json({ success: true, contacts: superadmins });
  }

  if (currentUser.userType === 'superadmin') {
    const recruiters = users
      .filter((user) => user.userType === 'recruiter' && hasPlatformAccess(user))
      .map((user) => {
        const conversationId = buildChatConversationId(currentUser, user);
        const conversationMessages = getConversationMessages(conversationId);
        const lastMessage = conversationMessages[conversationMessages.length - 1] || null;
        const unreadCount = conversationMessages.filter((message) => Number(message.receiverId) === Number(currentUser.id) && Number(message.blockIndex) > getConversationLastReadBlockIndex(conversationId, currentUser.id)).length;

        return {
          ...sanitizeManagedUser(user),
          conversationId,
          unreadCount,
          lastMessageAt: lastMessage?.createdAt || null,
          lastMessagePreview: buildChatAttachmentPreview(lastMessage),
          lastMessageHasAttachment: Boolean(lastMessage?.attachment)
        };
      })
      .sort((a, b) => String(b.lastMessageAt || '').localeCompare(String(a.lastMessageAt || '')) || String(a.name || '').localeCompare(String(b.name || '')));
    return res.json({ success: true, contacts: recruiters });
  }

  return res.status(403).json({ error: 'Only recruiters and superadmins can use chat' });
});

app.get('/api/chat/messages/:peerId', authenticateToken, (req, res) => {
  const currentUser = getCurrentUserFromRequest(req);
  const peerId = parseInt(req.params.peerId);
  const peerUser = users.find((user) => user.id === peerId);
  const validation = validateChatParticipants(currentUser, peerUser);

  if (!validation.valid) {
    return res.status(validation.status).json({ error: validation.error });
  }

  const conversationId = buildChatConversationId(currentUser, peerUser);
  const conversationMessages = getConversationMessages(conversationId);
  const messages = conversationMessages.map(sanitizeChatMessage);
  const integrity = verifyConversationIntegrity(conversationMessages);

  const finalize = async () => {
    const lastBlockIndex = conversationMessages.length ? conversationMessages[conversationMessages.length - 1].blockIndex : 0;
    if (lastBlockIndex > 0) {
      await markConversationRead(conversationId, currentUser.id, lastBlockIndex);
    }

    return res.json({
      success: true,
      conversationId,
      messages,
      integrity,
      peer: sanitizeManagedUser(peerUser)
    });
  };

  return finalize().catch((error) => {
    console.error('Chat read-state update error:', error);
    return res.status(500).json({ error: 'Failed to load messages' });
  });
});

app.post('/api/chat/messages', authenticateToken, upload.single('attachment'), async (req, res) => {
  try {
    const currentUser = getCurrentUserFromRequest(req);
    const peerId = parseInt(req.body?.peerId);
    const peerUser = users.find((user) => user.id === peerId);
    const text = String(req.body?.text || '').trim();
    const validation = validateChatParticipants(currentUser, peerUser);

    if (!validation.valid) {
      return res.status(validation.status).json({ error: validation.error });
    }

    if (!text && !req.file) {
      return res.status(400).json({ error: 'Message text or an attachment is required' });
    }

    const conversationId = buildChatConversationId(currentUser, peerUser);
    const attachment = await buildChatAttachment(req.file, conversationId);
    const message = createChatMessage(currentUser, peerUser, text, attachment);
    chatMessages.push(message);
    await saveChatMessages();

    const integrity = verifyConversationIntegrity(getConversationMessages(message.conversationId));
    return res.status(201).json({
      success: true,
      message: sanitizeChatMessage(message),
      integrity
    });
  } catch (error) {
    console.error('Chat send error:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

function normalizeRoleKey(value, fallback = 'General') {
  const trimmed = String(value || '').trim();
  return trimmed || fallback;
}

function normalizeUpgradeResource(resource) {
  return {
    id: resource.id,
    role: normalizeRoleKey(resource.role),
    title: String(resource.title || '').trim(),
    url: String(resource.url || '').trim(),
    description: String(resource.description || '').trim(),
    createdAt: resource.createdAt || null,
    updatedAt: resource.updatedAt || null,
    createdBy: resource.createdBy || null
  };
}

function isYouTubeUrl(url) {
  const value = String(url || '').trim().toLowerCase();
  return value.includes('youtube.com/') || value.includes('youtu.be/');
}

// Candidate-facing superadmin-curated resources
app.get('/api/upgrade-resources', authenticateToken, (req, res) => {
  if (!['candidate', 'recruiter', 'superadmin'].includes(req.user?.userType)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const requestedRole = normalizeRoleKey(req.query?.role, '').toLowerCase();
  const filtered = requestedRole
    ? upgradeResources.filter((item) => item.role.toLowerCase() === requestedRole || item.role.toLowerCase() === 'general')
    : upgradeResources;

  return res.json({
    success: true,
    resources: filtered
      .map(normalizeUpgradeResource)
      .sort((a, b) => String(a.role).localeCompare(String(b.role)) || String(a.title).localeCompare(String(b.title)))
  });
});

// Superadmin-only resource management for Upgrade Skills stage
app.get('/api/superadmin/resources', authenticateToken, requireSuperAdmin, (req, res) => {
  return res.json({
    success: true,
    resources: upgradeResources
      .map(normalizeUpgradeResource)
      .sort((a, b) => String(a.role).localeCompare(String(b.role)) || String(a.title).localeCompare(String(b.title)))
  });
});

app.post('/api/superadmin/resources', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const role = normalizeRoleKey(req.body?.role);
    const title = String(req.body?.title || '').trim();
    const url = String(req.body?.url || '').trim();
    const description = String(req.body?.description || '').trim();

    if (!title || !url) {
      return res.status(400).json({ error: 'role, title, and url are required' });
    }

    if (!isYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Only YouTube video links are allowed for superadmin resources' });
    }

    const resource = {
      id: upgradeResourceId++,
      role,
      title,
      url,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user?.email || 'superadmin'
    };

    upgradeResources.push(resource);
    await saveUpgradeResources();
    return res.status(201).json({ success: true, resource: normalizeUpgradeResource(resource) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create resource' });
  }
});

app.put('/api/superadmin/resources/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const idx = upgradeResources.findIndex((item) => item.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Resource not found' });

    const role = normalizeRoleKey(req.body?.role, upgradeResources[idx].role);
    const title = String(req.body?.title || upgradeResources[idx].title || '').trim();
    const url = String(req.body?.url || upgradeResources[idx].url || '').trim();
    const description = String(req.body?.description ?? upgradeResources[idx].description ?? '').trim();

    if (!title || !url) {
      return res.status(400).json({ error: 'role, title, and url are required' });
    }

    if (!isYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Only YouTube video links are allowed for superadmin resources' });
    }

    upgradeResources[idx] = {
      ...upgradeResources[idx],
      role,
      title,
      url,
      description,
      updatedAt: new Date().toISOString()
    };

    await saveUpgradeResources();
    return res.json({ success: true, resource: normalizeUpgradeResource(upgradeResources[idx]) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update resource' });
  }
});

app.delete('/api/superadmin/resources/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const before = upgradeResources.length;
    upgradeResources = upgradeResources.filter((item) => item.id !== id);
    if (upgradeResources.length === before) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    await saveUpgradeResources();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete resource' });
  }
});

// ==================== SUPER-ADMIN RECRUITER MANAGEMENT ====================

function getManagedUsers(userType) {
  return users
    .filter(u => u.userType === userType)
    .map((user) => ({
      ...sanitizeManagedUser(user),
      candidatesViewed: user.userType === 'recruiter'
        ? candidates.filter(c => (user.viewedCandidates || []).includes(c.id)).length
        : undefined,
      totalCandidatesInSystem: user.userType === 'recruiter' ? candidates.length : undefined,
      allowedCandidateIds: user.userType === 'recruiter' ? (user.allowedCandidateIds ?? null) : undefined
    }));
}

// GET all recruiters with their access status
app.get('/api/superadmin/recruiters', authenticateToken, requireSuperAdmin, (req, res) => {
  const recruiters = getManagedUsers('recruiter').map((user) => ({
    ...user,
    canViewCandidates: user.canViewCandidates !== false && user.canAccessPlatform !== false
  }));
  res.json({ success: true, recruiters });
});

// GET all candidate accounts with platform access status
app.get('/api/superadmin/candidates', authenticateToken, requireSuperAdmin, (req, res) => {
  res.json({ success: true, candidates: getManagedUsers('candidate') });
});

// GET managed users by type (candidate | recruiter)
app.get('/api/superadmin/users', authenticateToken, requireSuperAdmin, (req, res) => {
  const requestedType = String(req.query?.type || '').trim().toLowerCase();
  if (!['candidate', 'recruiter'].includes(requestedType)) {
    return res.status(400).json({ error: 'type query must be candidate or recruiter' });
  }

  return res.json({ success: true, users: getManagedUsers(requestedType) });
});

// GET super-admin platform stats
app.get('/api/superadmin/stats', authenticateToken, requireSuperAdmin, (req, res) => {
  const recruiterCount = users.filter(u => u.userType === 'recruiter').length;
  const candidateCount = candidates.length;
  const activeRecruiters = users.filter(u => u.userType === 'recruiter' && hasPlatformAccess(u)).length;
  const activeCandidates = users.filter(u => u.userType === 'candidate' && hasPlatformAccess(u)).length;
  const avgScore = candidateCount > 0
    ? Math.round(candidates.reduce((sum, c) => sum + (c.totalScore || 0), 0) / candidateCount)
    : 0;
  res.json({
    success: true,
    stats: { recruiterCount, activeRecruiters, candidateCount, activeCandidates, avgScore }
  });
});

// GET recent Auth0 audit logs (superadmin only)
app.get('/api/superadmin/auth-audit-logs', authenticateToken, requireSuperAdmin, (req, res) => {
  const parsedLimit = Number.parseInt(req.query?.limit, 10);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 500) : 100;
  const logs = authAuditLogs.slice(-limit).reverse();

  return res.json({
    success: true,
    count: logs.length,
    logs
  });
});

// PUT toggle platform access for any candidate or recruiter account
app.put('/api/superadmin/users/:id/access', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { canAccessPlatform, accessNote } = req.body;
    const user = users.find(u => u.id === id && ['candidate', 'recruiter'].includes(u.userType));
    if (!user) return res.status(404).json({ error: 'Managed user not found' });

    user.canAccessPlatform = Boolean(canAccessPlatform);
    if (user.userType === 'recruiter') {
      user.canViewCandidates = user.canAccessPlatform;
    }
    user.accessNote = accessNote || '';
    user.accessUpdatedAt = new Date().toISOString();
    await saveUsers();

    return res.json({ success: true, user: sanitizeManagedUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update user access' });
  }
});

// DELETE remove any managed user (candidate or recruiter)
app.delete('/api/superadmin/users/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userIndex = users.findIndex(u => u.id === id && ['candidate', 'recruiter'].includes(u.userType));
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Managed user not found' });
    }

    const [removedUser] = users.splice(userIndex, 1);
    let removedCandidateRecords = 0;

    if (removedUser.userType === 'candidate') {
      const removedEmail = String(removedUser.email || '').toLowerCase();
      const removedCandidateIds = candidates
        .filter(c => String(c.email || '').toLowerCase() === removedEmail)
        .map(c => c.id);

      if (removedCandidateIds.length > 0) {
        const removedIdSet = new Set(removedCandidateIds);
        removedCandidateRecords = removedCandidateIds.length;

        candidates = candidates.filter(c => !removedIdSet.has(c.id));

        users.forEach((u) => {
          if (u.userType === 'recruiter' && Array.isArray(u.viewedCandidates)) {
            u.viewedCandidates = u.viewedCandidates.filter(candidateId => !removedIdSet.has(candidateId));
          }
        });
      }
    }

    const previousSubscriptions = subscriptions.length;
    subscriptions = subscriptions.filter(s => Number(s.userId) !== removedUser.id);

    await saveUsers();
    if (removedCandidateRecords > 0) {
      await saveCandidates();
    }
    if (subscriptions.length !== previousSubscriptions) {
      await saveSubscriptions();
    }

    return res.json({
      success: true,
      removed: {
        id: removedUser.id,
        userType: removedUser.userType,
        email: removedUser.email,
        candidateRecordsRemoved: removedCandidateRecords
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to remove user' });
  }
});

// PUT set which candidates a recruiter can see (null = all, array = whitelist)
app.put('/api/superadmin/recruiters/:id/candidate-access', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const recruiter = users.find(u => u.id === id && u.userType === 'recruiter');
    if (!recruiter) return res.status(404).json({ error: 'Recruiter not found' });

    const { allowedCandidateIds } = req.body;
    // null/undefined = no restriction; array = explicit whitelist
    recruiter.allowedCandidateIds = Array.isArray(allowedCandidateIds)
      ? allowedCandidateIds.map(Number).filter(n => Number.isFinite(n))
      : null;
    recruiter.candidateAccessUpdatedAt = new Date().toISOString();
    await saveUsers();

    return res.json({ success: true, recruiter: sanitizeManagedUser(recruiter) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update candidate access' });
  }
});

// PUT toggle recruiter access
app.put('/api/superadmin/recruiters/:id/access', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { canViewCandidates, accessNote } = req.body;
    const user = users.find(u => u.id === id && u.userType === 'recruiter');
    if (!user) return res.status(404).json({ error: 'Recruiter not found' });

    user.canViewCandidates = Boolean(canViewCandidates);
    user.canAccessPlatform = Boolean(canViewCandidates);
    user.accessNote = accessNote || '';
    user.accessUpdatedAt = new Date().toISOString();
    await saveUsers();

    res.json({ success: true, recruiter: sanitizeManagedUser(user) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update access' });
  }
});

// PUT update recruiter details (name, company)
app.put('/api/superadmin/recruiters/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = users.find(u => u.id === id && u.userType === 'recruiter');
    if (!user) return res.status(404).json({ error: 'Recruiter not found' });

    const { name, company } = req.body;
    if (name) user.name = name;
    if (company) user.company = company;
    await saveUsers();

    const { password: _, ...safe } = user;
    res.json({ success: true, recruiter: safe });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update recruiter' });
  }
});

// Generate quiz questions
app.post('/api/generate-quiz', async (req, res) => {
  try {
    const { position, numQuestions = 5 } = req.body;

    // 1. Check admin question bank first (no API key needed)
    const adminQuestions = questionBank.filter(q => q.position.toLowerCase() === (position || '').toLowerCase());
    if (adminQuestions.length >= numQuestions) {
      // Shuffle and pick requested count
      const shuffled = adminQuestions.sort(() => Math.random() - 0.5).slice(0, numQuestions);
      return res.json({ success: true, questions: shuffled, source: 'admin' });
    }

    // 2. Try AI generation — uses OpenRouter (or any configured key)
    const hasApiKey = process.env.OPENROUTER_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (hasApiKey) {
      const prompt = `Generate exactly ${numQuestions} technical multiple-choice questions for a ${position} role.
Cover a broad range of topics: fundamentals, algorithms, system design, best practices, tools, and scenario-based questions.
Make every question distinct and practical.

Return ONLY a valid JSON array (no markdown, no comments):
[{
  "question": "Question text?",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": 0
}]`;
      const systemPrompt = `You are a senior technical interviewer generating a ${numQuestions}-question assessment. Return ONLY a valid JSON array, no markdown.`;
      try {
        const response = await callAI(prompt, systemPrompt, { task: 'quiz' });
        let cleaned = response.replace(/```json|```/g, '').trim();
        const match = cleaned.match(/\[\s*\{.*\}\s*\]/s);
        if (match) cleaned = match[0];
        const questions = JSON.parse(cleaned);
        return res.json({ success: true, questions, source: 'ai' });
      } catch (aiError) {
        console.error('AI generation error, falling back to built-in questions:', aiError.message);
      }
    }

    // 3. Built-in fallback question bank (no API key needed)
    return res.json({
      success: true,
      questions: getFallbackQuestions(position, numQuestions),
      source: 'fallback'
    });
  } catch (error) {
    console.error('Quiz generation error:', error);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

function getFallbackQuestions(position, count = 5) {
  const bank = {

    // ============================================================
    // SOFTWARE ENGINEER (30 questions)
    // ============================================================
    "Software Engineer": [
      { question: "What is the time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n²)", "O(1)"], correctAnswer: 1 },
      { question: "Which data structure uses the LIFO principle?", options: ["Queue", "Linked List", "Stack", "Hash Table"], correctAnswer: 2 },
      { question: "What does REST stand for?", options: ["Remote Execution Standard Transfer", "Representational State Transfer", "Real-time Execution State Transfer", "Resource Execution Standard Transfer"], correctAnswer: 1 },
      { question: "Which HTTP method is idempotent and safe?", options: ["POST", "PUT", "DELETE", "GET"], correctAnswer: 3 },
      { question: "What is the purpose of a hash table?", options: ["Sort elements quickly", "Store key-value pairs for O(1) average lookup", "Traverse trees", "Manage memory allocation"], correctAnswer: 1 },
      { question: "Which SOLID principle states a class should have only one reason to change?", options: ["Open/Closed", "Liskov Substitution", "Single Responsibility", "Interface Segregation"], correctAnswer: 2 },
      { question: "What is a deadlock in concurrent programming?", options: ["A slow network request", "A situation where two or more threads wait for each other indefinitely", "A memory overflow error", "A thread that runs without stopping"], correctAnswer: 1 },
      { question: "What is the average-case time complexity of QuickSort?", options: ["O(n)", "O(n log n)", "O(n²)", "O(log n)"], correctAnswer: 1 },
      { question: "What does DRY stand for in software development?", options: ["Don't Repeat Yourself", "Do Refactor Yearly", "Dynamic Runtime Yielding", "Data Retrieval Yield"], correctAnswer: 0 },
      { question: "What is the difference between a process and a thread?", options: ["They are the same", "A process is an independent program execution; a thread is a unit of execution within a process", "Threads use more memory than processes", "Processes run only in user space"], correctAnswer: 1 },
      { question: "What is memoization?", options: ["A way to write comments in code", "Caching results of expensive function calls to avoid redundant computation", "Storing data in a memo file", "A type of recursion"], correctAnswer: 1 },
      { question: "Which design pattern ensures only one instance of a class exists?", options: ["Factory", "Observer", "Singleton", "Decorator"], correctAnswer: 2 },
      { question: "What is a race condition?", options: ["A coding competition", "A bug that occurs when program behavior depends on the timing of uncontrollable events", "A performance benchmark", "A type of loop"], correctAnswer: 1 },
      { question: "What does the CAP theorem state?", options: ["A distributed system can guarantee all of Consistency, Availability, and Partition tolerance simultaneously", "A distributed system can only guarantee two of: Consistency, Availability, Partition tolerance", "CAP is a security model", "CAP refers to CPU, API, and Persistence"], correctAnswer: 1 },
      { question: "What is the purpose of an index in a database?", options: ["To encrypt data", "To speed up query lookups by creating a secondary data structure", "To backup the database", "To compress stored data"], correctAnswer: 1 },
      { question: "What is polymorphism in OOP?", options: ["The ability to inherit from multiple classes", "The ability of different objects to respond to the same method call in different ways", "Hiding internal data of an object", "Creating objects from a class"], correctAnswer: 1 },
      { question: "What is the difference between stack memory and heap memory?", options: ["No difference", "Stack is managed automatically for local variables; heap is for dynamically allocated memory", "Stack is larger than heap", "Heap is only for strings"], correctAnswer: 1 },
      { question: "What is a microservice architecture?", options: ["A monolithic app split into UI layers", "An approach where an application is composed of small, independently deployable services", "A tiny server with limited RAM", "A single-file backend application"], correctAnswer: 1 },
      { question: "Which sorting algorithm is most efficient for nearly sorted data?", options: ["QuickSort", "Merge Sort", "Insertion Sort", "Heap Sort"], correctAnswer: 2 },
      { question: "What does ACID stand for in databases?", options: ["Atomicity, Consistency, Isolation, Durability", "Access, Control, Index, Data", "Asynchronous, Concurrent, Indexed, Durable", "Automatic, Consistent, Integrated, Direct"], correctAnswer: 0 },
      { question: "What is a closure in programming?", options: ["A function that closes the application", "A function that retains access to its outer scope variables even after the outer function has returned", "A sealed class", "A private method"], correctAnswer: 1 },
      { question: "What is the Observer design pattern used for?", options: ["Creating objects", "Notifying dependent objects when the state of a subject changes", "Sorting collections", "Encrypting messages"], correctAnswer: 1 },
      { question: "What is tail recursion?", options: ["Recursion that never terminates", "A recursive call made as the final action of a function, enabling stack optimization", "Recursion with two base cases", "A loop converted to recursion"], correctAnswer: 1 },
      { question: "What is Big O notation O(1) called?", options: ["Logarithmic time", "Linear time", "Constant time", "Quadratic time"], correctAnswer: 2 },
      { question: "What is the purpose of a load balancer?", options: ["Store large amounts of data", "Distribute incoming network traffic across multiple servers", "Compress files", "Monitor application errors"], correctAnswer: 1 },
      { question: "What is an abstract class?", options: ["A class with no methods", "A class that cannot be instantiated directly and is meant to be subclassed", "A class with only static methods", "A globally accessible class"], correctAnswer: 1 },
      { question: "What does SQL JOIN do?", options: ["Deletes rows from multiple tables", "Combines rows from two or more tables based on a related column", "Creates a new table", "Backs up table data"], correctAnswer: 1 },
      { question: "What is the difference between TCP and UDP?", options: ["TCP is faster; UDP is slower", "TCP provides reliable, ordered delivery; UDP is faster but connectionless with no delivery guarantee", "UDP uses encryption; TCP does not", "They are the same protocol"], correctAnswer: 1 },
      { question: "What is lazy loading?", options: ["Loading all data at startup", "Deferring initialization of an object or resource until it's actually needed", "A slow internet connection pattern", "Loading images with low quality first"], correctAnswer: 1 },
      { question: "What is the purpose of a Git branch?", options: ["To delete code safely", "To isolate development work without affecting other parts of the codebase", "To merge code automatically", "To back up the repository"], correctAnswer: 1 },
    ],

    // ============================================================
    // DATA SCIENTIST (30 questions)
    // ============================================================
    "Data Scientist": [
      { question: "What is overfitting in machine learning?", options: ["Model performs well on train data but poorly on test data", "Model performs poorly on all data", "Model is too simple", "Model training takes too long"], correctAnswer: 0 },
      { question: "Which metric is best for imbalanced classification datasets?", options: ["Accuracy", "Mean Squared Error", "F1 Score", "R² Score"], correctAnswer: 2 },
      { question: "What does PCA stand for?", options: ["Predictive Component Analysis", "Principal Component Analysis", "Probabilistic Cluster Algorithm", "Partial Correlation Analysis"], correctAnswer: 1 },
      { question: "Which algorithm is a boosting ensemble method?", options: ["Random Forest", "K-Means", "XGBoost", "PCA"], correctAnswer: 2 },
      { question: "What is the bias-variance tradeoff?", options: ["Choosing between accuracy and speed", "Balancing underfitting (high bias) and overfitting (high variance)", "Splitting data into training and testing", "Normalizing features before training"], correctAnswer: 1 },
      { question: "What does a p-value less than 0.05 typically indicate?", options: ["The null hypothesis is true", "The result is statistically significant", "The model is overfitting", "The dataset is too small"], correctAnswer: 1 },
      { question: "Which technique is used to handle missing values?", options: ["Regularization", "Imputation", "Backpropagation", "Gradient descent"], correctAnswer: 1 },
      { question: "What is cross-validation used for?", options: ["Validating login credentials", "Assessing how well a model generalizes to independent datasets", "Checking for SQL injection", "Splitting features from labels"], correctAnswer: 1 },
      { question: "What is the purpose of the train-test split?", options: ["To increase dataset size", "To evaluate model performance on unseen data", "To normalize data", "To remove outliers"], correctAnswer: 1 },
      { question: "Which distance metric is used in K-Nearest Neighbors by default?", options: ["Manhattan distance", "Euclidean distance", "Cosine similarity", "Hamming distance"], correctAnswer: 1 },
      { question: "What does RMSE measure?", options: ["How many rows a model processes", "The square root of the average squared differences between predicted and actual values", "The model's training speed", "Classification accuracy"], correctAnswer: 1 },
      { question: "What is feature engineering?", options: ["Building new ML frameworks", "Creating new input features from raw data to improve model performance", "Engineering faster GPUs", "Removing all features except one"], correctAnswer: 1 },
      { question: "What is regularization in ML?", options: ["Making the data regular/uniform", "A technique to prevent overfitting by penalizing large model coefficients", "Normalizing outputs to 0–1 range", "A type of activation function"], correctAnswer: 1 },
      { question: "What is the difference between L1 and L2 regularization?", options: ["L1 uses squares, L2 uses absolute values", "L1 (Lasso) uses absolute values and can zero out features; L2 (Ridge) uses squared values", "L1 is for regression; L2 is for classification", "No difference"], correctAnswer: 1 },
      { question: "Which Python library is most commonly used for data manipulation?", options: ["NumPy", "Pandas", "Matplotlib", "Scikit-learn"], correctAnswer: 1 },
      { question: "What is a confusion matrix?", options: ["A matrix showing model parameters", "A table showing true positives, false positives, true negatives, and false negatives", "A heatmap of correlations", "A grid of hyperparameters"], correctAnswer: 1 },
      { question: "What is the ROC-AUC score?", options: ["A loss function value", "A metric measuring the ability of a classifier to distinguish between classes (higher = better)", "The model's training time", "A data normalization score"], correctAnswer: 1 },
      { question: "What is k-means clustering?", options: ["A supervised classification algorithm", "An unsupervised algorithm that partitions data into k clusters based on similarity", "A regression technique", "A dimensionality reduction method"], correctAnswer: 1 },
      { question: "What is the purpose of normalization/standardization in ML?", options: ["To remove missing values", "To scale features to a similar range so no single feature dominates", "To increase dataset size", "To remove duplicates"], correctAnswer: 1 },
      { question: "What is a decision tree's main advantage?", options: ["It never overfits", "It is interpretable and easy to visualize", "It always outperforms neural networks", "It requires no data preprocessing"], correctAnswer: 1 },
      { question: "What does NLP stand for?", options: ["Numeric Learning Protocol", "Natural Language Processing", "Neural Logic Programming", "Normalized Layered Prediction"], correctAnswer: 1 },
      { question: "What is the 'elbow method' used for?", options: ["Choosing the regularization parameter", "Determining the optimal number of clusters in K-Means", "Selecting the learning rate", "Splitting training data"], correctAnswer: 1 },
      { question: "What is the difference between bagging and boosting?", options: ["They are the same", "Bagging trains models in parallel on random subsets; boosting trains sequentially, focusing on errors", "Bagging is for classification; boosting is for regression", "Bagging requires more data than boosting"], correctAnswer: 1 },
      { question: "What is a correlation coefficient's range?", options: ["0 to 1", "-1 to 1", "0 to infinity", "-infinity to infinity"], correctAnswer: 1 },
      { question: "What is the purpose of a validation set?", options: ["To train the model", "To tune hyperparameters and prevent overfitting during model development", "To test final model performance", "To normalize features"], correctAnswer: 1 },
      { question: "What does SQL GROUP BY do?", options: ["Sorts rows alphabetically", "Groups rows sharing a common value to apply aggregate functions", "Filters rows by condition", "Joins two tables"], correctAnswer: 1 },
      { question: "What is one-hot encoding used for?", options: ["Encrypting categorical data", "Converting categorical variables into binary vectors for ML models", "Reducing dimensionality", "Normalizing numerical features"], correctAnswer: 1 },
      { question: "What is gradient boosting?", options: ["A way to speed up gradient descent", "An ensemble technique that builds models sequentially, each one correcting the errors of the previous", "A neural network optimizer", "A data imputation method"], correctAnswer: 1 },
      { question: "What is the main difference between supervised and unsupervised learning?", options: ["Supervised is faster", "Supervised uses labeled data; unsupervised finds patterns in unlabeled data", "Unsupervised always uses neural networks", "Supervised works only with images"], correctAnswer: 1 },
      { question: "What is a hyperparameter?", options: ["A parameter learned automatically during training", "A configuration set before training that controls the learning process (e.g., learning rate)", "A high-value feature", "An output of the model"], correctAnswer: 1 },
    ],

    // ============================================================
    // PRODUCT MANAGER (30 questions)
    // ============================================================
    "Product Manager": [
      { question: "What does MVP stand for in product development?", options: ["Most Viable Product", "Minimum Viable Product", "Maximum Value Proposition", "Minimum Variable Process"], correctAnswer: 1 },
      { question: "Which framework is commonly used for prioritizing product features?", options: ["Scrum", "RICE (Reach, Impact, Confidence, Effort)", "Kanban", "SWOT"], correctAnswer: 1 },
      { question: "What is a product roadmap?", options: ["A technical architecture diagram", "A high-level visual summary of product vision and direction over time", "A list of all bugs to fix", "A financial projection document"], correctAnswer: 1 },
      { question: "What is a KPI?", options: ["Key Product Interface", "Key Performance Indicator", "Knowledge Process Integration", "Key Priority Index"], correctAnswer: 1 },
      { question: "What does OKR stand for?", options: ["Outcome Key Results", "Objectives and Key Results", "Operational Key Requirements", "Output Knowledge Repository"], correctAnswer: 1 },
      { question: "What is the main purpose of A/B testing in a product?", options: ["Fixing bugs faster", "Comparing two versions to see which performs better", "Scaling the database", "Onboarding new team members"], correctAnswer: 1 },
      { question: "Which agile ceremony is used to reflect on the team process?", options: ["Sprint Planning", "Daily Standup", "Retrospective", "Backlog Grooming"], correctAnswer: 2 },
      { question: "What is a user story in agile?", options: ["A bug description", "A short description of a feature from the end-user's perspective", "A technical specification", "A marketing narrative"], correctAnswer: 1 },
      { question: "What does DAU/MAU ratio measure?", options: ["Data acquisition usage", "The ratio of Daily Active Users to Monthly Active Users, indicating user stickiness", "Design and UI metrics", "Debug and maintenance utilization"], correctAnswer: 1 },
      { question: "What is the Jobs-to-be-Done (JTBD) framework?", options: ["A HR hiring framework", "A framework focusing on what job a customer is trying to accomplish with a product", "A sprint planning methodology", "A feature estimation technique"], correctAnswer: 1 },
      { question: "What is churn rate?", options: ["The speed of data processing", "The percentage of customers who stop using the product over a given period", "The rate of new features shipped", "The number of bugs created per sprint"], correctAnswer: 1 },
      { question: "What is the difference between product vision and product strategy?", options: ["They are the same", "Vision is the long-term aspiration; strategy is the plan to achieve it", "Strategy is long-term; vision is short-term", "Vision is technical; strategy is about design"], correctAnswer: 1 },
      { question: "What is the MoSCoW prioritization method?", options: ["A geographic prioritization of markets", "Categorizing requirements as Must have, Should have, Could have, Won't have", "A machine learning model selection framework", "A code review process"], correctAnswer: 1 },
      { question: "What is product-market fit?", options: ["When the product's UI matches the market's color preferences", "When a product satisfies a strong market demand in a sustainable and scalable way", "When the dev team matches the sales team in size", "When marketing budgets are aligned to product costs"], correctAnswer: 1 },
      { question: "What is a sprint in Scrum?", options: ["A fast-paced hackathon", "A fixed time period (usually 1-4 weeks) during which a specific set of work is completed", "A code deployment pipeline", "A performance review cycle"], correctAnswer: 1 },
      { question: "What is a product backlog?", options: ["A list of old, unwanted features", "An ordered list of work items and requirements to be implemented in future sprints", "The list of deployed features", "A bug tracking system"], correctAnswer: 1 },
      { question: "What is NPS (Net Promoter Score)?", options: ["Network Performance Score", "A customer loyalty metric based on how likely users are to recommend the product", "New Product Score for launch readiness", "Number of Product Subscribers"], correctAnswer: 1 },
      { question: "What is the purpose of user interviews in product development?", options: ["To sell the product to users", "To gather qualitative insights about user needs, pain points, and behaviors", "To test the app for bugs", "To conduct performance reviews"], correctAnswer: 1 },
      { question: "What does 'time to value' mean for a product?", options: ["The time it takes to build a feature", "How long it takes a user to experience the core value of a product after signing up", "The product's pricing timeline", "The time between product launches"], correctAnswer: 1 },
      { question: "What is a go-to-market (GTM) strategy?", options: ["A map of physical store locations", "A plan describing how a product will reach its target customers and achieve competitive advantage", "A technical deployment guide", "A roadmap for going global"], correctAnswer: 1 },
      { question: "What is customer segmentation?", options: ["Dividing the engineering team into squads", "Dividing customers into groups based on shared characteristics to tailor products and marketing", "A billing system feature", "A user authentication method"], correctAnswer: 1 },
      { question: "What does the Kano model classify?", options: ["Software defects by severity", "Customer satisfaction vs. product features (Basic, Performance, Excitement needs)", "Employee performance levels", "Market segments by geography"], correctAnswer: 1 },
      { question: "What is a hypothesis in product experimentation?", options: ["A proven product fact", "A testable statement predicting an outcome if a specific change is made", "A user complaint", "A design specification"], correctAnswer: 1 },
      { question: "What is the difference between a feature and a benefit?", options: ["They are the same", "A feature is what a product does; a benefit is the value it provides to the user", "Benefits are technical, features are for marketing", "Features are for B2B, benefits for B2C"], correctAnswer: 1 },
      { question: "What is a PRD (Product Requirements Document)?", options: ["A privacy policy", "A document describing the purpose, features, and behavior of a product to be built", "A post-release documentation guide", "A pricing requirements matrix"], correctAnswer: 1 },
      { question: "What is the purpose of a product demo or prototype?", options: ["To finalize the product for launch", "To validate ideas, gather feedback, and align stakeholders before full development", "To train new engineers", "To document existing features"], correctAnswer: 1 },
      { question: "What is the North Star Metric?", options: ["A geographic market focus", "A single metric that best captures the core value a product delivers to customers", "The company's annual revenue target", "A UI accessibility standard"], correctAnswer: 1 },
      { question: "What is Definition of Done (DoD) in agile?", options: ["The acceptance criteria for a user story to be considered complete", "A list of done features in a release", "A team's workload capacity", "The end of a product lifecycle"], correctAnswer: 0 },
      { question: "What does 'velocity' measure in Scrum?", options: ["The speed of the app", "The amount of work completed by a team in a sprint, used to forecast future delivery", "The server response time", "The release cycle frequency"], correctAnswer: 1 },
      { question: "What is stakeholder management in product management?", options: ["Managing the product's technical stack", "The process of identifying, communicating with, and satisfying the needs of people who affect or are affected by the product", "Hiring and firing team members", "Managing cloud infrastructure costs"], correctAnswer: 1 },
    ],

    // ============================================================
    // FRONTEND DEVELOPER (30 questions)
    // ============================================================
    "Frontend Developer": [
      { question: "What does the CSS 'box model' consist of?", options: ["Content, padding, border, margin", "Width, height, font, color", "Flexbox, grid, float, position", "Header, body, footer, sidebar"], correctAnswer: 0 },
      { question: "Which JavaScript method is used to make asynchronous HTTP requests?", options: ["setTimeout()", "fetch()", "querySelector()", "addEventListener()"], correctAnswer: 1 },
      { question: "What is the Virtual DOM in React?", options: ["A database for React apps", "A lightweight in-memory copy of the real DOM used for efficient updates", "A browser API", "A CSS preprocessor"], correctAnswer: 1 },
      { question: "What does 'async/await' do in JavaScript?", options: ["Runs code in parallel threads", "Handles promises in a synchronous-looking syntax", "Compiles TypeScript to JavaScript", "Creates web workers"], correctAnswer: 1 },
      { question: "Which CSS unit is relative to the root element's font size?", options: ["em", "px", "rem", "vh"], correctAnswer: 2 },
      { question: "What is the purpose of webpack?", options: ["A CSS framework", "A JavaScript testing framework", "A module bundler for web assets", "A package manager"], correctAnswer: 2 },
      { question: "What does 'semantic HTML' mean?", options: ["Using HTML that is SEO-optimized", "Using HTML elements that convey meaning about their content", "Minifying HTML for performance", "Using only HTML5 elements"], correctAnswer: 1 },
      { question: "What is CSS Flexbox primarily used for?", options: ["3D transformations", "One-dimensional layout alignment of items in rows or columns", "Animating elements", "Defining font sizes"], correctAnswer: 1 },
      { question: "What is the difference between == and === in JavaScript?", options: ["No difference", "== checks value only; === checks both value and type", "=== is only for strings", "== is stricter than ==="], correctAnswer: 1 },
      { question: "What is event bubbling in the DOM?", options: ["Animations triggering on scroll", "An event propagating upward from the target element to ancestor elements", "A memory leak pattern", "CSS animation keyframes"], correctAnswer: 1 },
      { question: "What is React's useEffect hook used for?", options: ["State management only", "Performing side effects like data fetching, subscriptions, and DOM manipulation", "Creating new components", "Styling elements"], correctAnswer: 1 },
      { question: "What is the purpose of CSS Grid?", options: ["To create vector graphics", "Two-dimensional layout system for complex page structures", "To animate elements", "To define color schemes"], correctAnswer: 1 },
      { question: "What is a Promise in JavaScript?", options: ["A guaranteed function return value", "An object representing the eventual completion or failure of an asynchronous operation", "A CSS transition", "A type of loop"], correctAnswer: 1 },
      { question: "What does the 'z-index' CSS property control?", options: ["Element zoom level", "The stacking order of positioned elements", "Horizontal position", "Font weight"], correctAnswer: 1 },
      { question: "What is lazy loading in web performance?", options: ["Loading everything at page start", "Deferring loading of non-critical resources until they are needed", "A slow network technique", "Loading images at full resolution"], correctAnswer: 1 },
      { question: "What is the purpose of React's useState hook?", options: ["To fetch data", "To declare and manage reactive state in a functional component", "To apply CSS styles", "To create context"], correctAnswer: 1 },
      { question: "What is CORS in the context of frontend development?", options: ["A CSS framework", "A browser security mechanism that restricts cross-origin HTTP requests", "A JavaScript library", "A caching policy"], correctAnswer: 1 },
      { question: "What does 'responsive design' mean?", options: ["A design that responds to user clicks", "A design approach where layouts adapt to different screen sizes and devices", "A fast-loading website", "A design using animations"], correctAnswer: 1 },
      { question: "What is TypeScript?", options: ["A new browser", "A typed superset of JavaScript that compiles to plain JavaScript", "A CSS preprocessor", "A testing library"], correctAnswer: 1 },
      { question: "What is the purpose of localStorage in the browser?", options: ["To run server-side code", "To store key-value data persistently in the browser with no expiration", "To manage cookies", "To cache API responses automatically"], correctAnswer: 1 },
      { question: "What is code splitting in React?", options: ["Dividing a team to write separate components", "Splitting bundle into smaller chunks loaded on demand to improve performance", "Writing CSS in separate files", "Using multiple React versions"], correctAnswer: 1 },
      { question: "What is the difference between 'display: none' and 'visibility: hidden'?", options: ["No difference", "display:none removes the element from layout; visibility:hidden hides it but keeps its space", "visibility:hidden removes from DOM", "display:none keeps the space"], correctAnswer: 1 },
      { question: "What is the role of package.json in a frontend project?", options: ["Stores user data", "Lists project dependencies, scripts, and metadata", "Defines CSS variables", "Configures the web server"], correctAnswer: 1 },
      { question: "What is a React key prop used for?", options: ["Styling individual elements", "Helping React identify which items in a list have changed, are added, or removed", "Passing data between components", "Animating list items"], correctAnswer: 1 },
      { question: "What is the purpose of media queries in CSS?", options: ["To embed media files", "To apply different styles based on device characteristics like screen width", "To query a database", "To load images conditionally"], correctAnswer: 1 },
      { question: "What is the event loop in JavaScript?", options: ["A loop that handles user events only", "A mechanism that allows JavaScript to perform non-blocking operations by offloading tasks to the browser", "A loop that runs twice per second", "The main rendering loop"], correctAnswer: 1 },
      { question: "What does the 'position: absolute' CSS property do?", options: ["Centers the element", "Positions the element relative to its nearest positioned ancestor", "Makes the element fixed to the viewport", "Removes it from the document"], correctAnswer: 1 },
      { question: "What is the purpose of React Context?", options: ["To manage server state", "To share state across components without passing props manually at every level", "To create animations", "To handle routing"], correctAnswer: 1 },
      { question: "What is a CSS pseudo-class?", options: ["A fake CSS class", "A keyword added to a selector that specifies a special state of the element (e.g., :hover, :focus)", "A class that inherits from another", "A dynamic class applied via JS"], correctAnswer: 1 },
      { question: "What is tree shaking in JavaScript bundling?", options: ["Removing unused components from the React tree", "Eliminating dead/unused code from the final bundle to reduce size", "Reorganizing component hierarchy", "A CSS animation technique"], correctAnswer: 1 },
    ],

    // ============================================================
    // BACKEND DEVELOPER (30 questions)
    // ============================================================
    "Backend Developer": [
      { question: "What is the difference between SQL and NoSQL databases?", options: ["SQL is slower, NoSQL is faster", "SQL uses structured tables; NoSQL uses flexible schemas like documents or key-value", "SQL is for frontend, NoSQL is for backend", "SQL is open source, NoSQL is proprietary"], correctAnswer: 1 },
      { question: "What is a RESTful API?", options: ["An API using only WebSockets", "An API that follows REST architectural constraints (stateless, resource-based)", "An API that uses GraphQL exclusively", "An API that runs on the server only"], correctAnswer: 1 },
      { question: "What does JWT stand for?", options: ["Java Web Toolkit", "JSON Web Token", "JavaScript Worker Thread", "Java Web Transaction"], correctAnswer: 1 },
      { question: "What is middleware in Express.js?", options: ["A database ORM", "Functions that execute during the request-response cycle", "A CSS framework", "A testing library"], correctAnswer: 1 },
      { question: "What is database indexing used for?", options: ["Encrypting data", "Speeding up data retrieval operations", "Backing up data", "Normalizing tables"], correctAnswer: 1 },
      { question: "Which HTTP status code indicates a resource was successfully created?", options: ["200", "204", "201", "301"], correctAnswer: 2 },
      { question: "What is the purpose of environment variables in a backend app?", options: ["Style the UI", "Store configuration and secrets outside source code", "Manage database schemas", "Speed up compilation"], correctAnswer: 1 },
      { question: "What is database normalization?", options: ["Scaling the database horizontally", "Organizing data to reduce redundancy and improve data integrity", "Encrypting database fields", "Indexing all columns"], correctAnswer: 1 },
      { question: "What is the difference between authentication and authorization?", options: ["They are the same", "Authentication verifies identity; authorization determines what a user is allowed to do", "Authorization happens before authentication", "Authentication is only for APIs"], correctAnswer: 1 },
      { question: "What is an N+1 query problem in backend development?", options: ["Querying N tables instead of 1", "Loading a list of N items and then making N additional queries for each item's related data", "A SQL syntax error", "Using N indexes on one table"], correctAnswer: 1 },
      { question: "What is rate limiting in an API?", options: ["Limiting the API's response size", "Restricting the number of requests a client can make in a given time period", "Limiting API to certain IP addresses only", "A caching strategy"], correctAnswer: 1 },
      { question: "What is the purpose of bcrypt?", options: ["Encrypting network traffic", "Hashing passwords using a slow, salted algorithm to make brute-force attacks harder", "Compressing files", "Generating JWT tokens"], correctAnswer: 1 },
      { question: "What is a database transaction?", options: ["A single SQL query", "A sequence of operations treated as a single unit that either all succeed or all fail", "A database backup process", "A type of stored procedure"], correctAnswer: 1 },
      { question: "What is caching in backend systems?", options: ["Deleting old data", "Storing frequently accessed data in fast storage (e.g., Redis) to reduce database load", "Compressing API responses", "Logging all requests"], correctAnswer: 1 },
      { question: "What does GraphQL differ from REST?", options: ["GraphQL is faster by default", "GraphQL lets clients request exactly the data they need in a single request", "GraphQL only works with MongoDB", "REST supports real-time data; GraphQL does not"], correctAnswer: 1 },
      { question: "What is a foreign key in a relational database?", options: ["An encrypted primary key", "A field that creates a link between two tables by referencing the primary key of another table", "A key imported from another database", "An index on a non-primary column"], correctAnswer: 1 },
      { question: "What is horizontal vs vertical scaling?", options: ["Horizontal = faster CPU; Vertical = more servers", "Horizontal = adding more servers; Vertical = adding more resources (CPU/RAM) to existing servers", "They are the same", "Horizontal is for databases only"], correctAnswer: 1 },
      { question: "What is the purpose of a message queue (e.g., RabbitMQ, Kafka)?", options: ["To store relational data", "To decouple services by asynchronously passing messages between producers and consumers", "To cache API responses", "To route HTTP requests"], correctAnswer: 1 },
      { question: "What HTTP status code means 'Unauthorized'?", options: ["403", "404", "401", "500"], correctAnswer: 2 },
      { question: "What is a stored procedure in SQL?", options: ["A cached query result", "A precompiled set of SQL statements stored in the database that can be executed by name", "A backup procedure", "A database trigger"], correctAnswer: 1 },
      { question: "What is connection pooling in databases?", options: ["Connecting to multiple databases simultaneously", "Maintaining a pool of reusable database connections to reduce connection overhead", "A backup strategy", "A database indexing technique"], correctAnswer: 1 },
      { question: "What is an API gateway?", options: ["A physical server gateway", "A server that acts as an entry point for client requests, routing them to appropriate microservices", "A database proxy", "A caching layer"], correctAnswer: 1 },
      { question: "What does the HTTP OPTIONS method do?", options: ["Updates a resource", "Retrieves the supported HTTP methods for a resource (used in CORS preflight)", "Deletes a resource", "Fetches a resource"], correctAnswer: 1 },
      { question: "What is eventual consistency in distributed systems?", options: ["All nodes are always consistent", "Given enough time without updates, all nodes in a distributed system will converge to the same value", "A bug in distributed databases", "Consistency enforced by transactions"], correctAnswer: 1 },
      { question: "What is a webhook?", options: ["A front-end hook in React", "An HTTP callback that sends real-time data to a URL when a specific event occurs", "A browser API", "A type of middleware"], correctAnswer: 1 },
      { question: "What is the difference between PUT and PATCH in REST?", options: ["They are identical", "PUT replaces the entire resource; PATCH partially updates it", "PATCH replaces the full resource; PUT updates partially", "PUT is for files; PATCH is for JSON"], correctAnswer: 1 },
      { question: "What is a reverse proxy?", options: ["A proxy that hides the client", "A server that forwards client requests to backend servers and returns the response, hiding backend details", "A DNS resolver", "A load balancer simulator"], correctAnswer: 1 },
      { question: "What does OWASP Top 10 refer to?", options: ["The 10 most popular APIs", "A list of the 10 most critical web application security risks", "The top 10 database vendors", "A performance benchmark suite"], correctAnswer: 1 },
      { question: "What is the purpose of SSL/TLS in backend services?", options: ["To compress data", "To encrypt data in transit between client and server to prevent eavesdropping", "To authenticate users", "To speed up database queries"], correctAnswer: 1 },
      { question: "What is idempotency in APIs?", options: ["An API that only works once", "Property where making the same request multiple times produces the same result as making it once", "An API without authentication", "An always-erroring endpoint"], correctAnswer: 1 },
    ],

    // ============================================================
    // FULL STACK DEVELOPER (30 questions)
    // ============================================================
    "Full Stack Developer": [
      { question: "What is CORS and why is it important?", options: ["A database query language", "A browser security mechanism that controls cross-origin HTTP requests", "A CSS animation property", "A node package manager command"], correctAnswer: 1 },
      { question: "What is the difference between server-side rendering (SSR) and client-side rendering (CSR)?", options: ["SSR is faster to code; CSR is more secure", "SSR renders HTML on the server for each request; CSR renders in the browser using JavaScript", "SSR uses React; CSR uses Node.js", "SSR is only for mobile apps"], correctAnswer: 1 },
      { question: "Which database type is best for storing flexible, document-like data?", options: ["Relational (SQL)", "Document (MongoDB)", "Column-family (Cassandra)", "All are equally suitable"], correctAnswer: 1 },
      { question: "What is a WebSocket used for?", options: ["Running server-side scripts", "Full-duplex real-time communication between client and server", "Serving static files", "Authentication"], correctAnswer: 1 },
      { question: "What tool is commonly used to containerize full-stack applications?", options: ["Webpack", "Docker", "Babel", "Nginx alone"], correctAnswer: 1 },
      { question: "What is the purpose of an ORM (Object-Relational Mapper)?", options: ["Style web components", "Map database tables to programming objects to simplify queries", "Bundle JavaScript modules", "Compress images"], correctAnswer: 1 },
      { question: "What does CI/CD stand for?", options: ["Code Integration / Code Deployment", "Continuous Integration / Continuous Delivery", "Customer Interface / Customer Data", "Cloud Infrastructure / Cloud Delivery"], correctAnswer: 1 },
      { question: "What is the purpose of an .env file?", options: ["Store React component styles", "Store environment-specific configuration and secrets not committed to version control", "Configure webpack builds", "Define database schemas"], correctAnswer: 1 },
      { question: "What is the difference between cookies and localStorage?", options: ["No difference", "Cookies can be sent to server automatically and have expiry; localStorage is client-only", "localStorage is more secure than cookies", "Cookies are only for authentication"], correctAnswer: 1 },
      { question: "What is an API endpoint?", options: ["The last server in a chain", "A specific URL where an API is accessed, representing a resource or action", "The end of an API key", "A database connection string"], correctAnswer: 1 },
      { question: "What is the purpose of Nginx in a full-stack deployment?", options: ["A JavaScript runtime", "A web server/reverse proxy that serves static files and routes requests to backend", "A database engine", "A JavaScript bundler"], correctAnswer: 1 },
      { question: "What is JWT used for in full-stack apps?", options: ["Styling components", "Securely transmitting user identity information between client and server as a token", "Bundling assets", "Database queries"], correctAnswer: 1 },
      { question: "What is React Router used for?", options: ["Routing API requests to backend", "Managing client-side navigation between pages in a React single-page app", "Routing data between components", "Managing Redux state"], correctAnswer: 1 },
      { question: "What is state management in a full-stack context?", options: ["Managing server memory", "Tracking and updating application data (state) across components or the entire app", "Managing database state", "Load balancing requests"], correctAnswer: 1 },
      { question: "What does npm stand for?", options: ["Node Package Module", "Node Package Manager", "Node Project Manager", "Node Public Module"], correctAnswer: 1 },
      { question: "What is the purpose of a CDN (Content Delivery Network)?", options: ["To develop content faster", "To serve static assets from servers geographically closer to the user for faster load times", "To store user-uploaded content", "To generate dynamic server pages"], correctAnswer: 1 },
      { question: "What is the Node.js event loop?", options: ["A loop that processes HTTP requests only", "A mechanism that allows Node.js to perform non-blocking I/O by offloading operations", "A real-time debugging tool", "A scheduler for cron jobs"], correctAnswer: 1 },
      { question: "What is the difference between npm and yarn?", options: ["Yarn is for Python; npm is for JavaScript", "Both are JavaScript package managers; yarn is generally faster with better caching", "npm is deprecated", "Yarn cannot install devDependencies"], correctAnswer: 1 },
      { question: "What is a 404 HTTP error?", options: ["Internal Server Error", "Resource Not Found — the requested URL doesn't exist on the server", "Gateway Timeout", "Unauthorized access"], correctAnswer: 1 },
      { question: "What is Redis commonly used for?", options: ["Relational data storage", "In-memory caching, session storage, and pub/sub messaging", "File storage", "HTML rendering"], correctAnswer: 1 },
      { question: "What is database seeding?", options: ["Backing up data", "Populating a database with initial/test data for development or testing", "Indexing database tables", "Creating database schemas"], correctAnswer: 1 },
      { question: "What is the purpose of a .gitignore file?", options: ["To ignore git commands", "To specify files and directories that git should not track or commit", "To block collaborators", "To configure git settings"], correctAnswer: 1 },
      { question: "What is HTTPS vs HTTP?", options: ["HTTPS is faster", "HTTPS uses SSL/TLS to encrypt communication between client and server; HTTP does not", "HTTP is more modern", "HTTPS is only for banking sites"], correctAnswer: 1 },
      { question: "What is the purpose of Docker Compose?", options: ["To write Docker images", "To define and run multi-container Docker applications using a YAML configuration file", "To deploy to Kubernetes", "To monitor container performance"], correctAnswer: 1 },
      { question: "What is a monorepo?", options: ["A single-page React app", "A single repository containing code for multiple projects or services", "A database with one table", "A server with one API endpoint"], correctAnswer: 1 },
      { question: "What is the purpose of environment-specific builds (dev/staging/prod)?", options: ["To have different UI themes", "To use different configurations, API endpoints, and debug levels for each deployment environment", "To test on different browsers", "To run different JS versions"], correctAnswer: 1 },
      { question: "What is GraphQL's key advantage over REST?", options: ["It's always faster", "Clients can request exactly the fields they need, reducing over-fetching and under-fetching", "It uses SQL syntax", "It doesn't need a server"], correctAnswer: 1 },
      { question: "What is server-side validation vs client-side validation?", options: ["They are interchangeable and one is sufficient", "Both are needed: client-side for UX, server-side for security (never trust the client)", "Client-side is more secure", "Server-side is only for file uploads"], correctAnswer: 1 },
      { question: "What is microservices architecture vs monolith?", options: ["Microservices are always better", "A monolith is one unified app; microservices split functionality into independent deployable services", "A monolith is a database pattern", "Microservices can only use REST"], correctAnswer: 1 },
      { question: "What is the purpose of Postman in full-stack development?", options: ["To deploy apps", "To test and inspect API requests and responses during development", "To manage databases", "To build frontend UIs"], correctAnswer: 1 },
    ],

    // ============================================================
    // DEVOPS ENGINEER (30 questions)
    // ============================================================
    "DevOps Engineer": [
      { question: "What is Infrastructure as Code (IaC)?", options: ["Writing backend code", "Managing infrastructure through configuration files instead of manual processes", "A cloud provider service", "A programming language for servers"], correctAnswer: 1 },
      { question: "Which tool is used for container orchestration?", options: ["Jenkins", "Ansible", "Kubernetes", "Terraform"], correctAnswer: 2 },
      { question: "What is the purpose of a load balancer?", options: ["Increase server storage", "Distribute incoming traffic across multiple servers", "Monitor application logs", "Encrypt network traffic"], correctAnswer: 1 },
      { question: "What does 'Blue-Green Deployment' mean?", options: ["Deploying to dev and prod simultaneously", "Running two identical environments and switching traffic between them for zero-downtime releases", "Using blue and green color themes in dashboards", "A two-step code review process"], correctAnswer: 1 },
      { question: "Which tool is most commonly used for infrastructure provisioning on AWS?", options: ["Ansible", "Chef", "Terraform", "Puppet"], correctAnswer: 2 },
      { question: "What is a Docker image?", options: ["A screenshot of a running container", "A read-only template used to create containers", "A virtual machine", "A cloud storage bucket"], correctAnswer: 1 },
      { question: "What does SLA stand for in DevOps/SRE?", options: ["Server Latency Agreement", "Service Level Agreement", "Software Lifecycle Architecture", "Scalable Load Algorithm"], correctAnswer: 1 },
      { question: "What is the purpose of a CI/CD pipeline?", options: ["To manually deploy code", "To automate building, testing, and deploying code changes continuously", "To monitor server health", "To provision databases"], correctAnswer: 1 },
      { question: "What is a Kubernetes Pod?", options: ["A namespace in Kubernetes", "The smallest deployable unit in Kubernetes, containing one or more containers", "A load balancer", "A persistent volume"], correctAnswer: 1 },
      { question: "What does 'canary deployment' mean?", options: ["Deploying to all users at once", "Gradually rolling out a new release to a small subset of users before full rollout", "Deploying only to test environments", "A deployment that monitors bird activity"], correctAnswer: 1 },
      { question: "What is the purpose of Ansible in DevOps?", options: ["Container orchestration", "Agentless IT automation for configuration management and deployment", "Code version control", "Log aggregation"], correctAnswer: 1 },
      { question: "What is a Dockerfile?", options: ["A log file for Docker", "A script with instructions to build a Docker image", "A Docker configuration dashboard", "A Docker networking file"], correctAnswer: 1 },
      { question: "What is the difference between Docker and a virtual machine?", options: ["No difference", "Docker containers share the host OS kernel; VMs include a full guest OS, making containers lighter", "VMs are faster than Docker", "Docker requires more storage than VMs"], correctAnswer: 1 },
      { question: "What is observability in DevOps?", options: ["Watching server rooms physically", "The ability to measure a system's internal state from its external outputs (logs, metrics, traces)", "A monitoring dashboard", "A security audit process"], correctAnswer: 1 },
      { question: "What does SRE stand for?", options: ["Software Release Engineering", "Site Reliability Engineering", "Secure Runtime Environment", "System Resource Evaluation"], correctAnswer: 1 },
      { question: "What is the purpose of Prometheus in DevOps?", options: ["Code deployment", "An open-source monitoring system for collecting and querying metrics", "Container registry", "Configuration management"], correctAnswer: 1 },
      { question: "What is a Kubernetes namespace?", options: ["A DNS zone", "A mechanism to partition resources within a cluster for multiple teams/environments", "A Docker network", "A pod configuration file"], correctAnswer: 1 },
      { question: "What is the 'shift-left' approach in DevOps?", options: ["Moving servers to the left rack", "Integrating testing and security earlier in the development lifecycle", "A deployment rollback strategy", "Left-to-right CI/CD pipeline design"], correctAnswer: 1 },
      { question: "What is a rolling update in Kubernetes?", options: ["Replacing all pods simultaneously", "Incrementally updating pods with zero downtime by replacing them one at a time", "Reverting to a previous deployment", "Scaling down all pods"], correctAnswer: 1 },
      { question: "What does GitOps mean?", options: ["Using git for code reviews only", "Using Git as the source of truth for infrastructure/application declarative configuration", "A Git branching strategy", "A CI tool built on Git"], correctAnswer: 1 },
      { question: "What is the purpose of Grafana?", options: ["A CI/CD tool", "A visualization and analytics platform for monitoring metrics and logs", "A container registry", "A configuration management tool"], correctAnswer: 1 },
      { question: "What is MTTR in DevOps?", options: ["Mean Throughput Transfer Rate", "Mean Time to Recovery — the average time to restore a system after a failure", "Maximum Time to Release", "Monthly Test and Review"], correctAnswer: 1 },
      { question: "What is a Kubernetes Ingress?", options: ["A pod startup configuration", "An API object managing external HTTP/HTTPS access to services within a cluster", "A persistent storage claim", "A container health check"], correctAnswer: 1 },
      { question: "What does 'immutable infrastructure' mean?", options: ["Infrastructure that never changes configuration", "Infrastructure that is replaced rather than updated — servers are never modified in place", "Infrastructure with no databases", "Read-only cloud storage"], correctAnswer: 1 },
      { question: "What is the purpose of HashiCorp Vault?", options: ["Storing Docker images", "Securely storing and managing secrets, tokens, and sensitive configuration data", "Container orchestration", "Log management"], correctAnswer: 1 },
      { question: "What is chaos engineering?", options: ["Writing bad code on purpose", "Intentionally introducing failures into systems to test resilience and identify weaknesses", "A DevOps anti-pattern", "Merging untested code to production"], correctAnswer: 1 },
      { question: "What is a container registry?", options: ["A server inventory list", "A repository for storing, managing, and distributing Docker container images", "A Kubernetes namespace", "A CI/CD pipeline stage"], correctAnswer: 1 },
      { question: "What does 'artifact' mean in a CI/CD pipeline?", options: ["An old piece of code", "A deployable build output (e.g., a compiled binary, Docker image, or zip file)", "A git commit message", "A monitoring alert"], correctAnswer: 1 },
      { question: "What is the purpose of a health check in container deployments?", options: ["Checking team morale", "Verifying a container is running correctly so orchestrators can restart or reroute traffic if not", "A security vulnerability scan", "A performance load test"], correctAnswer: 1 },
      { question: "What is ELK Stack used for?", options: ["Machine learning pipelines", "Elasticsearch, Logstash, Kibana — a suite for log collection, processing, and visualization", "Container orchestration", "CDN management"], correctAnswer: 1 },
    ],

    // ============================================================
    // UI/UX DESIGNER (30 questions)
    // ============================================================
    "UI/UX Designer": [
      { question: "What does 'affordance' mean in UX design?", options: ["The cost of a design project", "A property of an object that shows users how to use it", "The color palette of an app", "The number of screens in a prototype"], correctAnswer: 1 },
      { question: "What is a user persona?", options: ["An actual user being tested", "A fictional character representing a user segment to guide design decisions", "A login page design", "A brand mascot"], correctAnswer: 1 },
      { question: "Which principle states that users should always know where they are in a system?", options: ["Fitts's Law", "Hick's Law", "Nielsen's Visibility of System Status", "Gestalt Principle"], correctAnswer: 2 },
      { question: "What is the purpose of a wireframe?", options: ["Define the final visual design", "Create a low-fidelity layout to plan structure and functionality", "Write the front-end code", "Conduct usability testing"], correctAnswer: 1 },
      { question: "What does WCAG stand for?", options: ["Web Content Accessibility Guidelines", "Web Color and Graphics standard", "Website Compliance and Governance", "Web Component Architecture Guide"], correctAnswer: 0 },
      { question: "What is a heuristic evaluation?", options: ["A user survey method", "An expert review of a UI against usability principles", "An A/B test on two designs", "A focus group session"], correctAnswer: 1 },
      { question: "What is the F-pattern in web reading?", options: ["Users read in the shape of the letter F, focusing on top and left content", "Users skip the first paragraph", "Users read from right to left", "Users only read bullet points"], correctAnswer: 0 },
      { question: "What is Fitts's Law in UX?", options: ["Users prefer fewer options", "The time to reach a target depends on the distance and size of the target", "Colors affect user mood", "Users read left to right"], correctAnswer: 1 },
      { question: "What is the difference between UI and UX?", options: ["They are the same", "UI is the visual design of the interface; UX is the overall experience of using the product", "UX is only about performance", "UI includes backend logic"], correctAnswer: 1 },
      { question: "What is Hick's Law?", options: ["Larger buttons are always better", "The more choices a user has, the longer it takes to make a decision", "Users prefer dark mode", "Simplicity always wins over aesthetics"], correctAnswer: 1 },
      { question: "What is a design system?", options: ["A CAD software for UI", "A collection of reusable components, guidelines, and standards for consistent product design", "A project management tool", "A color theory framework"], correctAnswer: 1 },
      { question: "What is the purpose of usability testing?", options: ["To test server performance", "To observe real users interacting with a product to identify usability issues", "To check security vulnerabilities", "To compare two design versions"], correctAnswer: 1 },
      { question: "What is visual hierarchy in design?", options: ["A chart of design team ranks", "The arrangement of elements to guide users' attention in order of importance", "A color ordering system", "A grid-based layout technique"], correctAnswer: 1 },
      { question: "What is a prototype in UX design?", options: ["A fully coded product", "A simulation of a product used to test ideas and gather feedback before development", "A final design document", "A brand style guide"], correctAnswer: 1 },
      { question: "What is the 'gestalt principle of proximity'?", options: ["Objects that look similar are perceived as related", "Objects placed near each other are perceived as a group", "Simple shapes are preferred by users", "Users notice differences before similarities"], correctAnswer: 1 },
      { question: "What is cognitive load in UX?", options: ["Server processing load", "The mental effort required by a user to understand and use an interface", "The number of screens in an app", "CSS animation complexity"], correctAnswer: 1 },
      { question: "What is the purpose of a style guide?", options: ["A user manual", "A document defining visual standards (colors, typography, spacing) for design consistency", "A backend API documentation", "A brand marketing plan"], correctAnswer: 1 },
      { question: "What tool is Figma used for?", options: ["Backend API development", "Collaborative UI/UX design, prototyping, and design system management", "Database design", "Video editing"], correctAnswer: 1 },
      { question: "What is card sorting in UX research?", options: ["Organizing business card contacts", "A technique where users group content into categories to inform information architecture", "A competitive analysis method", "A visual hierarchy exercise"], correctAnswer: 1 },
      { question: "What is the 80/20 rule (Pareto Principle) in UX?", options: ["80% of users use 80% of features", "80% of user problems come from 20% of usability issues", "Spend 80% of time on visual design", "Target 80% of the market"], correctAnswer: 1 },
      { question: "What is an information architecture (IA)?", options: ["The server infrastructure plan", "The structural design of shared information environments — how content is organized and navigated", "A sitemap for search engines", "A database schema design"], correctAnswer: 1 },
      { question: "What is the purpose of a user journey map?", options: ["A physical map of user locations", "A visualization of the steps a user takes to achieve a goal, including emotions and pain points", "A user registration flow", "A navigation menu design"], correctAnswer: 1 },
      { question: "What is 'progressive disclosure' in UI design?", options: ["Showing all features immediately", "Showing only necessary information initially and revealing complexity as needed", "Disclosing data to users", "A loading animation pattern"], correctAnswer: 1 },
      { question: "What does 'mobile-first design' mean?", options: ["Designing only for mobile", "Designing for mobile screens first, then scaling up to larger screens", "Making a mobile app before the website", "Prioritizing App Store submission"], correctAnswer: 1 },
      { question: "What is an eye-tracking study used for in UX?", options: ["Healthcare applications only", "Understanding where users look on a page to optimize layout and visual hierarchy", "Testing screen brightness", "Monitoring developer productivity"], correctAnswer: 1 },
      { question: "What is the difference between serif and sans-serif fonts?", options: ["Serif are modern; sans-serif are classic", "Serif fonts have small decorative strokes (e.g., Times New Roman); sans-serif do not (e.g., Arial)", "Sans-serif is only for headings", "Serif fonts are always larger"], correctAnswer: 1 },
      { question: "What is a 'call to action' (CTA) in UI design?", options: ["A phone support button", "A design element that prompts users to take a specific action (e.g., 'Sign Up', 'Buy Now')", "A tooltip that explains a feature", "A warning notification"], correctAnswer: 1 },
      { question: "What is the purpose of white space (negative space) in design?", options: ["Wasted screen space", "Intentional empty space that improves readability, focus, and visual clarity", "A placeholder for future content", "A background color choice"], correctAnswer: 1 },
      { question: "What is accessibility in the context of UX?", options: ["Speed of the app", "Designing products that can be used by people with disabilities (visual, motor, cognitive)", "A legal disclaimer requirement", "Backend API accessibility"], correctAnswer: 1 },
      { question: "What is the purpose of a user flow diagram?", options: ["Tracking server requests", "Mapping the path a user takes through a product to complete a task", "Defining database relationships", "Planning sprint tasks"], correctAnswer: 1 },
    ],

    // ============================================================
    // MACHINE LEARNING ENGINEER (30 questions)
    // ============================================================
    "Machine Learning Engineer": [
      { question: "What is gradient descent?", options: ["A data visualization technique", "An optimization algorithm that minimizes a loss function by iteratively updating parameters", "A regularization method", "A type of neural network layer"], correctAnswer: 1 },
      { question: "What is transfer learning?", options: ["Transferring data between databases", "Reusing a pre-trained model on a new but related task", "Converting a model from one language to another", "Moving ML models to production"], correctAnswer: 1 },
      { question: "What does 'batch normalization' do in deep learning?", options: ["Groups training data into batches", "Normalizes inputs of each layer to speed up training and improve stability", "Reduces the model size", "Increases the learning rate"], correctAnswer: 1 },
      { question: "What is a hyperparameter in ML?", options: ["A parameter learned during training", "A configuration setting set before training begins (e.g., learning rate)", "A type of neural network", "An output of the model"], correctAnswer: 1 },
      { question: "What is the purpose of dropout in neural networks?", options: ["Reduce model size permanently", "Randomly deactivate neurons during training to prevent overfitting", "Speed up inference", "Improve data loading"], correctAnswer: 1 },
      { question: "Which framework is most commonly used for building deep learning models?", options: ["Scikit-learn", "NumPy", "PyTorch / TensorFlow", "Pandas"], correctAnswer: 2 },
      { question: "What is the vanishing gradient problem?", options: ["Gradients become too large, causing instability", "Gradients become very small, making deep network layers learn very slowly or not at all", "The model forgets training data", "Loss function returns NaN"], correctAnswer: 1 },
      { question: "What is a convolutional neural network (CNN) primarily used for?", options: ["Natural language processing", "Image recognition and computer vision tasks", "Time series forecasting", "Reinforcement learning"], correctAnswer: 1 },
      { question: "What is an LSTM (Long Short-Term Memory) network used for?", options: ["Image classification", "Sequence and time-series data, retaining long-term dependencies", "Object detection", "Data normalization"], correctAnswer: 1 },
      { question: "What is the softmax function used for?", options: ["Regression output", "Converting a vector of raw scores into a probability distribution for multi-class classification", "Normalizing input features", "Applying dropout"], correctAnswer: 1 },
      { question: "What is the difference between precision and recall?", options: ["They are the same", "Precision = correct positive predictions / all positive predictions; Recall = correct positive predictions / all actual positives", "Recall measures speed; Precision measures accuracy", "Precision is for regression; Recall is for classification"], correctAnswer: 1 },
      { question: "What is MLOps?", options: ["A machine learning library", "The practice of applying DevOps principles to ML systems to streamline model development and deployment", "A type of optimization algorithm", "A model evaluation metric"], correctAnswer: 1 },
      { question: "What is a generative adversarial network (GAN)?", options: ["A network that only generates data", "Two networks (generator and discriminator) competing to produce realistic synthetic data", "A classification model", "A reinforcement learning agent"], correctAnswer: 1 },
      { question: "What is the purpose of the Adam optimizer?", options: ["Splitting data into batches", "An adaptive learning rate optimizer that combines momentum and RMSprop for faster convergence", "A regularization technique", "A loss function"], correctAnswer: 1 },
      { question: "What is feature importance in ML models?", options: ["The size of the dataset", "A measure of how much each feature contributes to the model's predictions", "The training speed of each feature", "The number of unique values in a feature"], correctAnswer: 1 },
      { question: "What is the purpose of a learning rate in neural networks?", options: ["The speed of the training hardware", "Controls how much the model parameters are updated in response to the estimated error each batch", "The number of training epochs", "The batch size for training"], correctAnswer: 1 },
      { question: "What is embedding in the context of NLP?", options: ["Inserting code into HTML", "Representing words or entities as dense vectors in a continuous vector space", "A data compression technique", "A type of tokenization"], correctAnswer: 1 },
      { question: "What is the purpose of a confusion matrix in ML?", options: ["To confuse the model intentionally", "A table showing correct and incorrect predictions broken down by class", "To visualize data distributions", "To tune hyperparameters"], correctAnswer: 1 },
      { question: "What is Reinforcement Learning?", options: ["Supervised learning with extra steps", "A training paradigm where an agent learns by taking actions and receiving rewards or penalties", "A clustering technique", "A type of data augmentation"], correctAnswer: 1 },
      { question: "What is the purpose of data augmentation in deep learning?", options: ["Cleaning the dataset", "Artificially increasing training data variety through transformations to improve model generalization", "Normalizing data", "Removing outliers"], correctAnswer: 1 },
      { question: "What does 'epoch' mean in ML training?", options: ["A training batch", "One complete pass through the entire training dataset", "A model checkpoint", "A training speed metric"], correctAnswer: 1 },
      { question: "What is the attention mechanism in transformers?", options: ["A marketing attention strategy", "A mechanism allowing models to focus on relevant parts of the input sequence dynamically", "A regularization technique", "A data preprocessing step"], correctAnswer: 1 },
      { question: "What is the purpose of a validation loss curve?", options: ["To measure server performance", "To detect overfitting — if it rises while training loss falls, the model is overfitting", "To track feature importance", "To evaluate model fairness"], correctAnswer: 1 },
      { question: "What is model quantization?", options: ["Counting model parameters", "Reducing model size by using lower-precision data types (e.g., float32 → int8) for faster inference", "Splitting a model into multiple parts", "A training speed optimization"], correctAnswer: 1 },
      { question: "What is the purpose of SHAP values in ML?", options: ["Measuring model training speed", "Explaining individual predictions by measuring each feature's contribution using game theory", "A type of neural network activation", "A loss function variant"], correctAnswer: 1 },
      { question: "What does 'model drift' mean in production ML?", options: ["The model moving to a new server", "Degradation of model performance over time due to changes in real-world data distribution", "A GPU memory error", "Overfitting on new data"], correctAnswer: 1 },
      { question: "What is a transformer model?", options: ["A power electronics component", "A neural network architecture using self-attention mechanisms, foundational to modern LLMs like GPT", "A feature transformation pipeline", "A data normalization method"], correctAnswer: 1 },
      { question: "What is the purpose of cross-entropy loss?", options: ["Measuring the distance between two embeddings", "A loss function for classification tasks measuring the difference between predicted and true probability distributions", "Computing gradient magnitudes", "Evaluating regression models"], correctAnswer: 1 },
      { question: "What is the bias in a neural network neuron?", options: ["A prejudice in training data", "A learnable parameter added to the weighted sum, allowing the model to shift the activation function", "The model's error on training data", "A regularization term"], correctAnswer: 1 },
      { question: "What is A/B testing used for in ML systems?", options: ["Comparing two models on separate user groups to determine which performs better in production", "Testing a model on two datasets", "Switching between two ML frameworks", "A type of cross-validation"], correctAnswer: 0 },
    ],

    // ============================================================
    // ANDROID DEVELOPER (30 questions)
    // ============================================================
    "Android Developer": [
      { question: "What language is primarily used for modern Android development?", options: ["Java", "Swift", "Kotlin", "Dart"], correctAnswer: 2 },
      { question: "What is the purpose of an Android Manifest file?", options: ["Store app assets", "Declare app components, permissions, and metadata", "Define UI layouts", "Manage gradle dependencies"], correctAnswer: 1 },
      { question: "What is an Activity in Android?", options: ["A background service", "A single screen with a user interface", "A database helper class", "A broadcast receiver"], correctAnswer: 1 },
      { question: "What is Jetpack Compose?", options: ["A music app", "Android's modern declarative UI toolkit", "A testing framework", "A dependency injection library"], correctAnswer: 1 },
      { question: "What is the role of ViewModel in Android MVVM architecture?", options: ["Handle UI rendering", "Survive configuration changes and hold UI-related data", "Manage database operations only", "Send network requests"], correctAnswer: 1 },
      { question: "Which library is commonly used for dependency injection in Android?", options: ["Retrofit", "Room", "Hilt / Dagger", "Glide"], correctAnswer: 2 },
      { question: "What is the difference between Service and IntentService?", options: ["No difference", "Service runs on main thread; IntentService runs on a worker thread and stops when done", "IntentService is deprecated from API 1", "Service is only for background audio"], correctAnswer: 1 },
      { question: "What is a Fragment in Android?", options: ["A broken Activity", "A reusable UI component that can be embedded in an Activity", "A background job", "A network request handler"], correctAnswer: 1 },
      { question: "What is Room in Android Jetpack?", options: ["A UI layout container", "An abstraction layer over SQLite for local database persistence", "A background service manager", "A navigation library"], correctAnswer: 1 },
      { question: "What is Retrofit used for in Android?", options: ["Loading images", "A type-safe HTTP client for Android for making API calls", "Dependency injection", "Local database operations"], correctAnswer: 1 },
      { question: "What is the RecyclerView used for in Android?", options: ["Recycling memory", "Efficiently displaying large, scrollable lists of data", "Handling device orientation", "Playing audio files"], correctAnswer: 1 },
      { question: "What is Coroutines in Kotlin used for in Android?", options: ["UI animations", "Writing asynchronous, non-blocking code in a sequential style", "Database queries", "Dependency injection"], correctAnswer: 1 },
      { question: "What is the Android Activity lifecycle?", options: ["A coding style guide", "A sequence of states (Created, Started, Resumed, Paused, Stopped, Destroyed) an Activity goes through", "A version history of Android APIs", "A UI component state machine"], correctAnswer: 1 },
      { question: "What is the purpose of SharedPreferences in Android?", options: ["To share data between apps", "To store small, key-value data persistently on the device", "To share images", "To manage user accounts"], correctAnswer: 1 },
      { question: "What is WorkManager in Android Jetpack?", options: ["A project management tool", "A library for scheduling deferrable, guaranteed background work", "A UI threading manager", "An animation scheduler"], correctAnswer: 1 },
      { question: "What is the difference between dp and sp in Android?", options: ["No difference", "dp is density-independent pixels for layouts; sp is scale-independent pixels for text (respects font size settings)", "dp is for images; sp is for spacing", "sp is larger than dp always"], correctAnswer: 1 },
      { question: "What is the Navigation Component in Android?", options: ["A GPS library", "A Jetpack library for managing in-app navigation and back stack between fragments/activities", "A networking library", "A UI routing table"], correctAnswer: 1 },
      { question: "What is LiveData in Android?", options: ["Real-time server data", "An observable data holder class that is lifecycle-aware and updates UI automatically", "A media streaming library", "A background thread handler"], correctAnswer: 1 },
      { question: "What is the purpose of Gradle in Android development?", options: ["A code editor plugin", "A build automation tool managing dependencies, building, and packaging the Android app", "A version control system", "A UI debugging tool"], correctAnswer: 1 },
      { question: "What is a BroadcastReceiver in Android?", options: ["A Bluetooth device", "A component that listens for system-wide or app-wide broadcast messages/events", "A network socket", "A push notification handler"], correctAnswer: 1 },
      { question: "What is Glide used for in Android?", options: ["Dependency injection", "Efficient image loading, caching, and display in Android apps", "Database ORM", "Networking"], correctAnswer: 1 },
      { question: "What is the purpose of ProGuard/R8 in Android?", options: ["Code formatting", "Shrinking, obfuscating, and optimizing the app's bytecode for release builds", "Decoding resources", "Running tests"], correctAnswer: 1 },
      { question: "What is the difference between onCreate() and onStart() in an Activity?", options: ["No difference", "onCreate() is called once when Activity is first created; onStart() is called when it becomes visible", "onStart() initializes views; onCreate() handles data", "onCreate() is for fragments only"], correctAnswer: 1 },
      { question: "What is an Intent in Android?", options: ["A user's goal", "An asynchronous message used to communicate between components (start activities, services, etc.)", "A network request", "A database query"], correctAnswer: 1 },
      { question: "What is the purpose of ProGuard rules in Android?", options: ["To speed up compilation", "To configure which classes/methods should not be obfuscated or removed during minification", "To add new libraries", "To format code"], correctAnswer: 1 },
      { question: "What is the difference between Activity and Fragment back stack?", options: ["They are the same", "Activity back stack is managed by the OS; Fragment back stack is managed within an Activity", "Fragments cannot use back stack", "Activity back stack holds fragments too"], correctAnswer: 1 },
      { question: "What is Android's Data Binding library?", options: ["Connecting to databases", "Binding UI components in layouts to data sources declaratively, eliminating boilerplate code", "A network binding library", "Linking activities to services"], correctAnswer: 1 },
      { question: "What APK stands for?", options: ["Android Programming Kit", "Android Package Kit — the file format for Android app distribution", "Application Process Key", "Automatic Protocol Key"], correctAnswer: 1 },
      { question: "What is the purpose of onSaveInstanceState() in Android?", options: ["Saving the entire app state to a file", "Saving UI state data before an Activity is destroyed due to configuration changes", "Taking a screenshot of the current screen", "Persisting data to a database"], correctAnswer: 1 },
      { question: "What is Jetpack DataStore used for?", options: ["Data binding", "A modern replacement for SharedPreferences using coroutines for storing key-value or typed objects", "Image caching", "Network caching"], correctAnswer: 1 },
    ],

    // ============================================================
    // IOS DEVELOPER (30 questions)
    // ============================================================
    "iOS Developer": [
      { question: "What language is used for modern iOS development?", options: ["Objective-C", "Kotlin", "Flutter", "Swift"], correctAnswer: 3 },
      { question: "What is SwiftUI?", options: ["A testing framework", "Apple's declarative UI framework for building UIs across Apple platforms", "A networking library", "A database for iOS"], correctAnswer: 1 },
      { question: "What is ARC in iOS development?", options: ["Advanced Runtime Compiler", "Automatic Reference Counting — manages memory automatically", "App Resource Controller", "Application Rendering Cache"], correctAnswer: 1 },
      { question: "What is the role of AppDelegate in an iOS app?", options: ["Handle network requests", "Entry point that manages app-level events and lifecycle", "Define the main UI", "Manage Core Data"], correctAnswer: 1 },
      { question: "What is Core Data used for in iOS?", options: ["Networking", "Local data persistence and object graph management", "Push notifications", "UI animations"], correctAnswer: 1 },
      { question: "What is the MVVM pattern?", options: ["Model-View-ViewModel: separates logic from UI using a ViewModel", "A design pattern for database schemas", "A network protocol", "A testing methodology"], correctAnswer: 0 },
      { question: "What does Xcode Instruments help with?", options: ["Writing Swift code", "Profiling and debugging performance, memory, and energy issues", "Submitting apps to the App Store", "Designing UI mockups"], correctAnswer: 1 },
      { question: "What is UIKit?", options: ["A Swift testing library", "Apple's traditional framework for building iOS UIs programmatically or with Interface Builder", "A UI component library from Google", "A cross-platform development kit"], correctAnswer: 1 },
      { question: "What is the difference between struct and class in Swift?", options: ["No difference", "Structs are value types (copied on assignment); classes are reference types (shared)", "Classes are faster than structs", "Structs support inheritance"], correctAnswer: 1 },
      { question: "What is a closure in Swift?", options: ["A sealed class", "A self-contained block of functionality that can be passed around and used in your code", "A Swift module", "A memory management technique"], correctAnswer: 1 },
      { question: "What is URLSession used for in iOS?", options: ["URL shortening", "Making HTTP network requests in iOS apps", "Managing URL routing", "Opening URLs in Safari"], correctAnswer: 1 },
      { question: "What is the purpose of the Codable protocol in Swift?", options: ["Making classes copiable", "Encoding and decoding data to/from formats like JSON automatically", "A networking protocol", "A memory management protocol"], correctAnswer: 1 },
      { question: "What is Combine in iOS development?", options: ["A UI layout tool", "Apple's reactive programming framework for handling asynchronous events and data streams", "A networking library replacement", "A Swift testing framework"], correctAnswer: 1 },
      { question: "What is the purpose of optional in Swift?", options: ["A way to make variables optional in API params", "A type that can hold either a value or nil, preventing null pointer crashes", "A performance optimization", "A deprecated Objective-C type"], correctAnswer: 1 },
      { question: "What is a Storyboard in iOS?", options: ["A user story document", "A visual representation of the app's UI flow and view controllers used in Interface Builder", "A project management file", "An Xcode plugin"], correctAnswer: 1 },
      { question: "What is Grand Central Dispatch (GCD) used for in iOS?", options: ["Navigation dispatch", "Managing concurrent tasks and threading on Apple platforms", "Sending push notifications", "Handling device sensors"], correctAnswer: 1 },
      { question: "What is the purpose of @State in SwiftUI?", options: ["Global app state", "A property wrapper that marks a value as state within a SwiftUI view, triggering re-renders on change", "A data model decorator", "A networking state manager"], correctAnswer: 1 },
      { question: "What is TestFlight used for in iOS development?", options: ["Unit testing Swift code", "Distributing beta versions of iOS apps to testers before App Store release", "UI performance testing", "A Xcode testing plugin"], correctAnswer: 1 },
      { question: "What is Keychain used for in iOS?", options: ["Managing API keys in code", "Securely storing sensitive data like passwords and tokens on the device", "Locking the iPhone screen", "A Core Data encryption layer"], correctAnswer: 1 },
      { question: "What is the difference between push and pop in UINavigationController?", options: ["No difference", "Push adds a view controller to the stack; pop removes it to go back", "Pop adds; Push removes", "Push is for modals; pop is for sheets"], correctAnswer: 1 },
      { question: "What is @ObservedObject in SwiftUI?", options: ["A struct property wrapper", "A property wrapper for referencing an external ObservableObject, re-rendering the view when it changes", "A Core Data binding", "A network observer"], correctAnswer: 1 },
      { question: "What is Swift Package Manager (SPM)?", options: ["A physical package shipping tool", "Apple's built-in tool for adding and managing code dependencies in Swift projects", "A replacement for CocoaPods only", "A code formatting tool"], correctAnswer: 1 },
      { question: "What is the purpose of UserDefaults in iOS?", options: ["Default app behaviors", "Storing small, simple user preferences and settings", "Managing user authentication", "Storing large data blobs"], correctAnswer: 1 },
      { question: "What is the difference between synchronous and asynchronous tasks in iOS?", options: ["No difference", "Synchronous blocks the thread until done; asynchronous allows code to continue and handles completion later", "Asynchronous is always faster", "Synchronous is for UI; async is for background"], correctAnswer: 1 },
      { question: "What is async/await in Swift?", options: ["A loop mechanism", "A modern concurrency syntax for writing asynchronous code in a readable, sequential style", "A data binding pattern", "A networking protocol"], correctAnswer: 1 },
      { question: "What is App Store Connect used for?", options: ["Writing iOS apps", "Managing app submissions, TestFlight, metadata, analytics, and sales for the App Store", "Debugging Xcode apps", "Designing app icons"], correctAnswer: 1 },
      { question: "What is a delegate pattern in iOS?", options: ["Delegating tasks to another team", "A design pattern where one object acts on behalf of another by conforming to a protocol", "A memory management pattern", "A data persistence technique"], correctAnswer: 1 },
      { question: "What is the purpose of lazy var in Swift?", options: ["Variables that are declared but never used", "A property that is only initialized when first accessed, saving memory if it's not always needed", "A slow variable declaration", "A thread-safe property"], correctAnswer: 1 },
      { question: "What is WKWebView used for in iOS?", options: ["Displaying AR content", "Embedding web content within an iOS app", "A WebSocket client", "Displaying PDF files only"], correctAnswer: 1 },
      { question: "What is the purpose of APNS (Apple Push Notification Service)?", options: ["Apple's payment system", "Apple's infrastructure for delivering push notifications to iOS, macOS, and other Apple devices", "App performance monitoring", "App preview notifications"], correctAnswer: 1 },
    ],

    // ============================================================
    // QA ENGINEER (30 questions)
    // ============================================================
    "QA Engineer": [
      { question: "What is the difference between black-box and white-box testing?", options: ["Black-box tests internal code; white-box tests the UI", "Black-box tests without knowledge of internals; white-box tests with full code knowledge", "No difference", "Black-box is automated; white-box is manual"], correctAnswer: 1 },
      { question: "What is regression testing?", options: ["Testing new features only", "Re-testing after changes to ensure existing functionality still works", "Testing on multiple devices", "Performance load testing"], correctAnswer: 1 },
      { question: "What does TDD stand for?", options: ["Test Data Development", "Test-Driven Development", "Technical Design Document", "Total Defect Density"], correctAnswer: 1 },
      { question: "What is a test case?", options: ["A bug report", "A set of conditions and expected results used to determine if a system works correctly", "A production incident", "A user story"], correctAnswer: 1 },
      { question: "Which tool is commonly used for API testing?", options: ["Selenium", "Postman", "JUnit", "Jira"], correctAnswer: 1 },
      { question: "What is smoke testing?", options: ["Testing all edge cases", "A quick preliminary test to check basic functionality before deeper testing", "Performance testing under heavy load", "Testing in a staging environment only"], correctAnswer: 1 },
      { question: "What is a defect's 'severity' vs 'priority'?", options: ["They are the same concept", "Severity = impact on system functionality; Priority = urgency of fixing it", "Priority = impact; Severity = timeline", "Severity is set by developers; Priority by stakeholders"], correctAnswer: 1 },
      { question: "What is exploratory testing?", options: ["Testing that follows a strict test plan", "Simultaneous learning, test design, and execution where the tester actively explores the application", "Automated browser testing", "Testing only new features"], correctAnswer: 1 },
      { question: "What is a test suite?", options: ["A QA team office", "A collection of test cases grouped together for execution", "A testing environment setup", "A type of test report"], correctAnswer: 1 },
      { question: "What is performance testing?", options: ["Testing if the app looks good", "Testing how a system behaves under load, including speed, scalability, and stability", "Testing only critical paths", "A code review process"], correctAnswer: 1 },
      { question: "What is the difference between load testing and stress testing?", options: ["No difference", "Load testing checks behavior under expected load; stress testing pushes beyond capacity to find breaking points", "Stress testing is for UI; load testing for APIs", "Load testing is slower"], correctAnswer: 1 },
      { question: "What is Selenium used for?", options: ["API testing", "Automating web browser interactions for functional UI testing", "Performance testing", "Mobile app testing"], correctAnswer: 1 },
      { question: "What is a bug life cycle?", options: ["The lifespan of a software product", "The stages a defect goes through: New, Assigned, Open, Fixed, Verified, Closed", "A testing schedule", "A product release cycle"], correctAnswer: 1 },
      { question: "What is boundary value analysis (BVA)?", options: ["Testing only the middle values of a range", "Testing at the boundaries of input ranges where bugs are most likely to occur", "A black-box testing technique for security", "Testing extreme user behaviors"], correctAnswer: 1 },
      { question: "What is equivalence partitioning?", options: ["Splitting the testing team equally", "Dividing input into partitions where all values in a partition are expected to behave the same way", "A performance testing strategy", "A bug classification method"], correctAnswer: 1 },
      { question: "What is a test plan?", options: ["A sprint backlog", "A document describing the scope, approach, resources, and schedule for testing activities", "A list of bugs to fix", "A deployment checklist"], correctAnswer: 1 },
      { question: "What is the purpose of a test environment?", options: ["A physical QA workspace", "A configured system (hardware/software/network) representing production conditions for testing", "A mock database", "A developer's local machine only"], correctAnswer: 1 },
      { question: "What is BDD (Behavior-Driven Development)?", options: ["A database development approach", "A testing approach where tests are written in plain language describing user behavior (Given-When-Then)", "A backend development methodology", "A branch management strategy"], correctAnswer: 1 },
      { question: "What is the purpose of a test automation framework?", options: ["To replace manual testers entirely", "To provide structure and reusable tools for writing, executing, and managing automated tests", "To generate test data automatically", "To schedule deployments"], correctAnswer: 1 },
      { question: "What is Appium used for?", options: ["Web UI testing", "Automating native, hybrid, and mobile web apps on iOS and Android", "Performance testing", "API contract testing"], correctAnswer: 1 },
      { question: "What is end-to-end (E2E) testing?", options: ["Testing only the backend APIs", "Testing the entire application flow from the user's perspective, simulating real user scenarios", "Testing code units in isolation", "A security scanning process"], correctAnswer: 1 },
      { question: "What is code coverage in testing?", options: ["How many lines of code have been written", "The percentage of source code executed during testing", "The number of test files relative to source files", "A metric for code quality reviews"], correctAnswer: 1 },
      { question: "What is the difference between functional and non-functional testing?", options: ["No difference", "Functional tests verify what the system does; non-functional tests verify how well it does it (performance, security)", "Functional tests are automated; non-functional are manual", "Non-functional tests are for APIs only"], correctAnswer: 1 },
      { question: "What is a mock in unit testing?", options: ["A fake user account", "A simulated version of a dependency (e.g., database or API) that controls test behavior", "A test data file", "A test double that records calls"], correctAnswer: 1 },
      { question: "What is the purpose of CI in a QA workflow?", options: ["To deploy code manually", "To automatically run tests on every code commit, catching bugs early", "To manage test cases", "To perform security audits"], correctAnswer: 1 },
      { question: "What is acceptance testing?", options: ["Testing performed by developers", "Testing that verifies the system meets business requirements and is accepted by the client/stakeholders", "Automated testing only", "A post-deployment monitoring process"], correctAnswer: 1 },
      { question: "What is a flaky test?", options: ["A test written poorly", "A test that produces inconsistent results (passes and fails) without code changes", "A test that always fails", "A test with many assertions"], correctAnswer: 1 },
      { question: "What is security testing?", options: ["Testing with a password", "Testing to identify vulnerabilities and ensure the system is protected from threats", "Running antivirus scans", "A performance testing variant"], correctAnswer: 1 },
      { question: "What is test data management?", options: ["Managing the QA team's data", "The process of creating, maintaining, and controlling data used in testing to ensure accuracy and coverage", "A database backup process", "Generating random test users"], correctAnswer: 1 },
      { question: "What does 'shift-right testing' mean?", options: ["Moving tests to the start of development", "Testing in production or near-production environments to catch real-world issues post-deployment", "Testing on the right side of the screen", "A test prioritization method"], correctAnswer: 1 },
    ],
  };

  // Case-insensitive position matching
  const key = Object.keys(bank).find(k => k.toLowerCase() === (position || '').toLowerCase()) || 'Software Engineer';
  const questionSet = bank[key];
  // Shuffle for variety, then slice
  const shuffled = questionSet.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Create candidate
app.post('/api/candidates', async (req, res) => {
  try {
    const { name, email, position } = req.body;

    const candidate = {
      id: candidateId++,
      name,
      email,
      position: String(position || '').trim(),
      resumeScore: 0,
      quizScore: 0,
      interviewScore: 0,
      videoInterviewScore: 0,
      totalScore: 0,
      createdAt: new Date().toISOString()
    };

    candidates.push(candidate);
    await saveCandidates(); // Save to cloud

    res.status(201).json({
      success: true,
      candidate
    });
  } catch (error) {
    console.error('Candidate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all candidates (super admin / recruiter)
app.get('/api/candidates', authenticateToken, async (req, res) => {
  try {
    res.json({ success: true, candidates });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update candidate status
app.put('/api/candidates/:id/status', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    const candidate = candidates.find(c => c.id === id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    candidate.status = status;
    await saveCandidates();
    res.json({ success: true, candidate });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resume analysis
app.post('/api/candidates/:id/resume', upload.single('resume'), async (req, res) => {
  try {
    const candidateId = parseInt(req.params.id);
    const candidate = candidates.find(c => c.id === candidateId);

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No resume file uploaded' });
    }

    // Extract text from document
    // On Vercel memory storage: req.file.buffer exists, no req.file.path
    // On local disk storage: req.file.path exists
    let resumeText;
    try {
      const fileSource = req.file.buffer || req.file.path;
      resumeText = await extractTextFromDocument(fileSource, req.file.mimetype);
    } catch (extractError) {
      console.error('Text extraction failed:', extractError);
      return res.status(400).json({ error: 'Failed to read resume. Please ensure file is not corrupted or password-protected.' });
    }

    // Upload resume to Google Cloud Storage
    let resumeUrl = null;
    if (useGCS) {
      const cloudPath = `resumes/${candidateId}/${Date.now()}-${req.file.originalname}`;
      resumeUrl = await uploadFileToCloud(req.file.path, cloudPath);
    }

    // AI analysis with focus on projects
    const prompt = `Analyze this resume for a ${candidate.position} position.

**SPECIAL FOCUS: ATS Friendliness & Real-Life Projects**
Evaluate if the resume is ATS-friendly. If it's not (e.g., poor formatting, lack of keywords), provide specific suggestions on how to improve it.
Pay special attention to identifying and evaluating practical projects, real-world experience, and hands-on work.

Resume Text:
${resumeText}

STRICT SCHEMA REQUIREMENTS:
- Return a single valid JSON object only.
- No markdown, no code fences, no trailing commentary.
- Required keys: atsScore, projectScore, projects, strengths, improvements, projectAnalysis.
- atsScore and projectScore must be integers from 0 to 100.
- projects must be an array of objects with name, description, technologies (array), impact.

Provide analysis in this EXACT JSON schema shape:
{
  "atsScore": 85,
  "projectScore": 90,
  "projects": [
    {
      "name": "Project name",
      "description": "Brief description of what was built",
      "technologies": ["Tech1", "Tech2"],
      "impact": "What problem it solved or business value"
    }
  ],
  "strengths": [
    "Strong project portfolio with real-world impact",
    "Clear demonstration of problem-solving skills",
    "Diverse technology stack"
  ],
  "improvements": [
    "Add more quantifiable metrics to projects",
    "Include project outcomes and results",
    "How to make resume more ATS friendly if ATS score is low"
  ],
  "projectAnalysis": "Detailed evaluation of hands-on experience and practical skills demonstrated through projects"
}

Focus on:
1. ATS Friendliness: Is the format clean? Are there enough keywords? If the score is low, suggest how to make it better in 'improvements'.
2. Identifying ALL real-life projects (personal, professional, open-source, freelance).
3. Technologies and tools used in practice.
4. Problem-solving demonstrated through projects.
5. Impact and outcomes of project work.
6. Hands-on technical skills vs theoretical knowledge.`;

  const systemPrompt = "You are TalentAI, an expert ATS and resume evaluator. Follow schema strictly and return only valid JSON object output.";

    try {
      const useCheapMode = req.body?.useCheapMode === true || String(req.body?.useCheapMode || '').toLowerCase() === 'true';
      const abTest = req.body?.abTest === true || String(req.body?.abTest || '').toLowerCase() === 'true';

      let parsed = null;
      try {
        const routed = await evaluateResumeParsing(
          {
            position: candidate.position,
            resumeText
          },
          {
            useCheapMode,
            abTest
          }
        );

        parsed = routed?.result || null;
        console.log(`[TalentAI][MODEL][RESUME_PARSING] Routed model: ${routed?.modelUsed || 'unknown'}`);
      } catch (routerError) {
        console.error('[TalentAI][MODEL][RESUME_PARSING] Router failed, falling back to legacy AI call:', routerError.message);
      }

      if (!parsed || typeof parsed !== 'object' || parsed.atsScore === undefined) {
        const analysis = await callAI(prompt, systemPrompt, { task: 'resume' });
        parsed = parseJsonFromAI(analysis, 'object');
      }

      const validated = normalizeResumeAnalysis(parsed, resumeText);

      candidate.resumeScore = validated.atsScore;
      candidate.resumeUrl = resumeUrl; // Save GCS URL
      candidate.resumeAnalyzedAt = new Date().toISOString();
      await saveCandidates(); // Persist to cloud

      // Clean up uploaded file
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete uploaded file:', unlinkError);
      }

      res.json({
        success: true,
        analysis: validated
      });
    } catch (aiError) {
      console.error('AI analysis error:', aiError);

      // Fallback with project extraction
      const projectKeywords = ['project', 'built', 'developed', 'created', 'implemented', 'designed'];
      const hasProjects = projectKeywords.some(keyword =>
        resumeText.toLowerCase().includes(keyword)
      );

      candidate.resumeScore = 75;
      candidate.resumeUrl = resumeUrl; // Save GCS URL
      candidate.resumeAnalyzedAt = new Date().toISOString();
      await saveCandidates(); // Persist to cloud

      res.json({
        success: true,
        analysis: {
          atsScore: 75,
          projectScore: hasProjects ? 80 : 60,
          projects: hasProjects ? [
            {
              name: "Identified Project",
              description: "Projects detected in resume - detailed analysis requires successful AI processing",
              technologies: ["Various technologies mentioned"]
            }
          ] : [],
          strengths: [
            "Professional resume format",
            hasProjects ? "Practical project experience mentioned" : "Clear experience presentation",
            "Relevant for position"
          ],
          improvements: [
            "Add more quantifiable metrics and outcomes",
            "Highlight specific technologies used in projects",
            "Include measurable impact of work"
          ],
          projectAnalysis: hasProjects
            ? "Resume contains project references. Full analysis temporarily unavailable."
            : "Consider adding more hands-on project examples to demonstrate practical skills."
        }
      });
    }
  } catch (error) {
    console.error('Resume analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze resume' });
  }
});

async function transcribeVideoWithOpenAI(file) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !file) return '';

  try {
    const buffer = file.buffer || await fs.readFile(file.path);
    const blob = new Blob([buffer], { type: file.mimetype || 'application/octet-stream' });
    const form = new FormData();
    form.append('file', blob, file.originalname || 'candidate-video.webm');
    form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe');
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');
    if (process.env.OPENAI_TRANSCRIBE_LANGUAGE) {
      form.append('language', process.env.OPENAI_TRANSCRIBE_LANGUAGE);
    }

    const response = await fetchWithTimeout('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: form
    }, Math.max(12000, AI_REQUEST_TIMEOUT_MS));

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(raw || `OpenAI transcription failed (${response.status})`);
    }

    try {
      const parsed = JSON.parse(raw);
      return normalizeSpeechTranscript(parsed?.text || '');
    } catch {
      return normalizeSpeechTranscript(raw);
    }
  } catch (error) {
    console.error('Video transcription error:', error.message);
    return '';
  }
}

function normalizeSpeechTranscript(transcript = '') {
  return String(transcript || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\b(uh+|um+|erm+|hmm+)\b/gi, '')
    .replace(/\s([,.!?;:])/g, '$1')
    .trim();
}

function transcriptLooksNoisy(transcript = '') {
  const text = String(transcript || '').trim();
  if (!text) return true;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 20) return true;

  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const uniqueRatio = uniqueWords.size / words.length;
  return uniqueRatio < 0.28;
}

async function enhanceTranscriptForScoring(transcript = '', position = 'Candidate') {
  const normalized = normalizeSpeechTranscript(transcript);
  if (!normalized) return '';

  const hasApiKey = process.env.OPENROUTER_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!hasApiKey) return normalized;

  const prompt = `Clean and reconstruct this noisy interview transcript for a ${position} role.

Transcript:
${normalized}

Rules:
- Preserve the candidate meaning and intent.
- Fix obvious ASR errors, punctuation, and sentence boundaries.
- Do not invent new claims, achievements, or technologies.
- Output only cleaned plain text transcript.`;

  const systemPrompt = 'You are an expert transcript cleaner. Return plain text only.';

  try {
    const cleaned = await callAI(prompt, systemPrompt, { task: 'interview' });
    return normalizeSpeechTranscript(cleaned) || normalized;
  } catch (error) {
    console.error('Transcript enhancement error:', error.message);
    return normalized;
  }
}

function fallbackSpeechVideoAnalysis(transcript = '', position = 'Candidate') {
  const words = String(transcript || '').trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const keywords = extractInterviewKeywords(position, 6);
  const lowerTranscript = transcript.toLowerCase();
  const relevanceHits = keywords.filter(k => lowerTranscript.includes(k.toLowerCase())).length;

  const clarityScore = clampScore(Math.min(25, Math.round(8 + wordCount / 12)), 0, 25, 12);
  const relevanceScore = clampScore(Math.min(25, 8 + (relevanceHits * 4)), 0, 25, 12);
  const confidenceScore = clampScore(Math.min(25, Math.round(10 + wordCount / 18)), 0, 25, 12);
  const communicationScore = clampScore(Math.min(25, Math.round((clarityScore + relevanceScore + confidenceScore) / 3 + 2)), 0, 25, 12);
  const totalScore = clampScore(clarityScore + relevanceScore + confidenceScore + communicationScore, 0, 100, 55);

  return {
    transcript: String(transcript || '').trim(),
    clarityScore,
    relevanceScore,
    confidenceScore,
    communicationScore,
    totalScore,
    strengths: [
      'Candidate communicated key ideas in understandable language',
      'Response showed intent aligned with the target role',
      'Speech content included meaningful professional context'
    ],
    improvements: [
      'Use more structured examples with measurable outcomes',
      'Improve role-specific keyword depth and technical detail',
      'Reduce filler words and keep a clear STAR-style flow'
    ],
    summary: `Speech-based evaluation completed for ${position}. Transcript quality suggests ${totalScore >= 75 ? 'strong readiness' : totalScore >= 60 ? 'moderate readiness with improvements needed' : 'early-stage readiness that needs coaching'}.`
  };
}

async function analyzeSpeechTranscriptWithAI(transcript = '', position = 'Candidate', analysisType = 'live') {
  const initialTranscript = normalizeSpeechTranscript(transcript);
  if (!initialTranscript) return fallbackSpeechVideoAnalysis('', position);

  const safeTranscript = transcriptLooksNoisy(initialTranscript)
    ? await enhanceTranscriptForScoring(initialTranscript, position)
    : initialTranscript;

  const hasApiKey = process.env.OPENROUTER_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!hasApiKey) return fallbackSpeechVideoAnalysis(safeTranscript, position);

  const prompt = `You are evaluating a candidate's spoken interview content for role: ${position}.
Analysis type: ${analysisType}

Transcript:
${safeTranscript}

Return ONLY valid JSON object:
{
  "clarityScore": 0,
  "relevanceScore": 0,
  "confidenceScore": 0,
  "communicationScore": 0,
  "totalScore": 0,
  "strengths": ["string", "string", "string"],
  "improvements": ["string", "string", "string"],
  "summary": "string"
}

Rules:
- clarityScore, relevanceScore, confidenceScore, communicationScore are integers 0-25.
- totalScore is integer 0-100 and should align with component scores.
- strengths and improvements must be practical and based on transcript evidence.`;

  const systemPrompt = 'You are a strict interview evaluator. Return JSON only.';

  try {
    let parsed = null;
    try {
      const routed = await evaluateInterview(
        {
          transcript: safeTranscript,
          position,
          analysisType
        },
        {
          useCheapMode: false,
          abTest: false
        }
      );

      parsed = routed?.result || null;
      console.log(`[TalentAI][MODEL][INTERVIEW_EVAL] Routed model: ${routed?.modelUsed || 'unknown'}`);
    } catch (routerError) {
      console.error('[TalentAI][MODEL][INTERVIEW_EVAL] Router failed, falling back to legacy AI call:', routerError.message);
    }

    if (!parsed || typeof parsed !== 'object' || parsed.totalScore === undefined) {
      const raw = await callAI(prompt, systemPrompt, { task: 'interview' });
      parsed = parseJsonFromAI(raw, 'object');
    }

    const clarityScore = clampScore(parsed.clarityScore, 0, 25, 12);
    const relevanceScore = clampScore(parsed.relevanceScore, 0, 25, 12);
    const confidenceScore = clampScore(parsed.confidenceScore, 0, 25, 12);
    const communicationScore = clampScore(parsed.communicationScore, 0, 25, 12);

    const strengths = Array.isArray(parsed.strengths)
      ? parsed.strengths.map(s => String(s || '').trim()).filter(Boolean).slice(0, 5)
      : fallbackSpeechVideoAnalysis(safeTranscript, position).strengths;

    const improvements = Array.isArray(parsed.improvements)
      ? parsed.improvements.map(s => String(s || '').trim()).filter(Boolean).slice(0, 5)
      : fallbackSpeechVideoAnalysis(safeTranscript, position).improvements;

    return {
      transcript: safeTranscript,
      clarityScore,
      relevanceScore,
      confidenceScore,
      communicationScore,
      totalScore: clampScore(parsed.totalScore, 0, 100, clarityScore + relevanceScore + confidenceScore + communicationScore),
      strengths,
      improvements,
      summary: String(parsed.summary || '').trim() || `Speech analysis completed for ${position}.`
    };
  } catch (error) {
    console.error('Speech analysis AI error:', error.message);
    return fallbackSpeechVideoAnalysis(safeTranscript, position);
  }
}

// Video interview and upload speech analysis
app.post('/api/candidates/:id/video-interview', upload.single('video'), async (req, res) => {
  try {
    const candidateId = parseInt(req.params.id);
    const candidate = candidates.find(c => c.id === candidateId);

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const analysisType = String(req.body?.analysisType || 'live').trim().toLowerCase();
    const rolePosition = String(req.body?.position || candidate.position || 'Candidate').trim();
    const providedTranscript = String(req.body?.transcript || '').trim();

    let videoUrl = null;
    if (useGCS && req.file?.path) {
      const cloudPath = `videos/${candidateId}/${Date.now()}-${req.file.originalname}`;
      videoUrl = await uploadFileToCloud(req.file.path, cloudPath);
    }

    let transcript = providedTranscript;
    if (!transcript && req.file) {
      transcript = await transcribeVideoWithOpenAI(req.file);
    }

    const analysis = await analyzeSpeechTranscriptWithAI(transcript, rolePosition, analysisType);

    if (analysisType === 'upload') {
      candidate.uploadVideoScore = analysis.totalScore;
      candidate.uploadVideoTranscript = analysis.transcript;
      candidate.uploadVideoAnalyzedAt = new Date().toISOString();
      if (videoUrl) candidate.uploadVideoUrl = videoUrl;
    } else {
      candidate.videoInterviewScore = analysis.totalScore;
      candidate.videoInterviewTranscript = analysis.transcript;
      candidate.videoAnalyzedAt = new Date().toISOString();
      if (videoUrl) candidate.videoUrl = videoUrl;
    }

    await saveCandidates();

    if (req.file?.path) {
      try { await fs.unlink(req.file.path); } catch {}
    }

    return res.json({
      success: true,
      videoAnalysis: {
        analysis,
        analyzedAt: new Date().toISOString(),
        type: analysisType
      },
      score: analysis.totalScore
    });
  } catch (error) {
    console.error('Video interview error:', error);
    res.status(500).json({ error: 'Failed to process video interview' });
  }
});

// ==================== CAREER ADVICE (100% LOCAL — NO API KEYS) ====================

// Comprehensive local career advice engine
function generateLocalCareerAdvice(position, totalScore, resumeScore, quizScore, interviewScore) {
  const pos = (position || 'Software Engineer').trim();
  const tier = totalScore >= 85 ? 'high' : totalScore >= 65 ? 'mid' : 'low';

  // ── POSITION-SPECIFIC SKILL DATABASE ───────────────────────────────────────
  const SKILLS_DB = {
    'Software Engineer': {
      skills: [
        { skill: 'Data Structures & Algorithms', reason: 'Core requirement for FAANG and top-tier tech interviews', url: 'https://leetcode.com/explore/learn/', tag: 'LeetCode Explore' },
        { skill: 'System Design', reason: 'Essential for mid-to-senior SWE roles; covers scalability & architecture', url: 'https://github.com/donnemartin/system-design-primer', tag: 'System Design Primer (GitHub)' },
        { skill: 'Clean Code & Design Patterns', reason: 'Improves code quality and makes you a better team collaborator', url: 'https://refactoring.guru/design-patterns', tag: 'Refactoring.Guru' },
        { skill: 'Git & Version Control', reason: 'Non-negotiable for any professional software role', url: 'https://www.atlassian.com/git/tutorials', tag: 'Atlassian Git Tutorials' },
        { skill: 'REST API Design', reason: 'Backend/full-stack teams need solid API design skills', url: 'https://restfulapi.net/', tag: 'RestfulAPI.net' },
        { skill: 'Cloud Fundamentals (AWS/GCP)', reason: 'Cloud skills are now expected at most tech companies', url: 'https://aws.amazon.com/training/digital/', tag: 'AWS Free Digital Training' },
      ],
      companies: {
        high:  [{ name: 'Google', type: 'enterprise', url: 'https://careers.google.com', reason: 'Strong systems knowledge and high quiz/interview scores match Google SWE expectations' }, { name: 'Microsoft', type: 'enterprise', url: 'https://careers.microsoft.com', reason: 'Excellent written communication and solid technical skills fit Microsoft engineering culture' }, { name: 'Razorpay', type: 'mid-size', url: 'https://razorpay.com/jobs/', reason: 'Fast-growing fintech startup in India with excellent SWE roles and competitive pay' }],
        mid:   [{ name: 'Infosys', type: 'enterprise', url: 'https://www.infosys.com/careers/', reason: 'Large-scale projects and structured training for software engineers at mid level' }, { name: 'Zoho Corporation', type: 'mid-size', url: 'https://careers.zohocorp.com', reason: 'Product-focused company with strong engineering culture and India-based HQ' }, { name: 'Freshworks', type: 'mid-size', url: 'https://www.freshworks.com/company/careers/', reason: 'Chennai-based SaaS with growing global engineering teams' }],
        low:   [{ name: 'Wipro', type: 'enterprise', url: 'https://careers.wipro.com', reason: 'Strong fresher hiring programs with structured onboarding and training' }, { name: 'Cognizant', type: 'enterprise', url: 'https://careers.cognizant.com', reason: 'Ideal for entry-level engineers; strong mentorship and client-based projects' }, { name: 'TCS (Tata Consultancy Services)', type: 'enterprise', url: 'https://www.tcs.com/careers', reason: 'Largest IT employer in India; great for beginners to build foundations' }]
      },
      strengths_high: ['Strong grasp of algorithms and data structures', 'Demonstrated ability to design scalable systems', 'Clear technical communication in interviews'],
      strengths_mid:  ['Good foundational programming knowledge', 'Solid problem-solving approach', 'Eagerness to learn and grow demonstrated'],
      strengths_low:  ['Shows willingness to learn new technologies', 'Basic understanding of software development lifecycle', 'Good attitude towards improvement'],
      weaknesses_high: ['System design depth could be improved for senior roles', 'Broaden knowledge of distributed systems concepts', 'Practice more behavioral interview questions (STAR method)'],
      weaknesses_mid:  ['Technical quiz performance needs strengthening', 'More hands-on project experience is needed', 'Interview confidence and articulation needs work'],
      weaknesses_low:  ['Core programming fundamentals need significant practice', 'Needs real project experience to back up knowledge', 'Interview preparation and mock sessions are essential'],
    },

    'Data Scientist': {
      skills: [
        { skill: 'Python for Data Science', reason: 'Python is the #1 language for data science globally', url: 'https://www.kaggle.com/learn/python', tag: 'Kaggle Learn (Free)' },
        { skill: 'Machine Learning with Scikit-learn', reason: 'Standard ML library used across industry for rapid prototyping', url: 'https://scikit-learn.org/stable/tutorial/index.html', tag: 'Scikit-learn Docs' },
        { skill: 'SQL for Data Analysis', reason: 'Every data role requires SQL for querying and transforming data', url: 'https://mode.com/sql-tutorial/', tag: 'Mode SQL Tutorial (Free)' },
        { skill: 'Data Visualization (Matplotlib/Tableau)', reason: 'Communicating insights visually is a critical skill', url: 'https://www.tableau.com/learn/training', tag: 'Tableau Free Training' },
        { skill: 'Statistics & Probability', reason: 'Statistical foundations underpin every ML model decision', url: 'https://www.khanacademy.org/math/statistics-probability', tag: 'Khan Academy Statistics' },
        { skill: 'Deep Learning (PyTorch/TensorFlow)', reason: 'Advanced DS roles increasingly require DL knowledge', url: 'https://www.fast.ai/', tag: 'fast.ai (Free Course)' },
      ],
      companies: {
        high:  [{ name: 'Amazon', type: 'enterprise', url: 'https://amazon.jobs', reason: 'Heavy ML usage in recommendations, Alexa and fulfillment optimization' }, { name: 'Flipkart', type: 'mid-size', url: 'https://tech.flipkart.com/jobs/', reason: "India's biggest e-commerce company with a strong data science team" }, { name: 'DataWeave', type: 'startup', url: 'https://dataweave.com/careers', reason: 'AI-powered retail analytics startup perfect for high-performing data scientists' }],
        mid:   [{ name: 'Mu Sigma', type: 'mid-size', url: 'https://www.mu-sigma.com/careers', reason: 'Decision sciences company with strong data analytics focus' }, { name: 'ICICI Bank Analytics', type: 'enterprise', url: 'https://www.icicicareers.com', reason: 'Financial data and risk analytics team — growing data science division' }, { name: 'Ola', type: 'mid-size', url: 'https://www.olacabs.com/careers', reason: 'Ride-hailing platform with complex routing & demand forecasting problems' }],
        low:   [{ name: 'Accenture AI', type: 'enterprise', url: 'https://www.accenture.com/in-en/careers', reason: 'Large consulting firm with strong AI/data entry programs' }, { name: 'Capgemini', type: 'enterprise', url: 'https://www.capgemini.com/in-en/careers/', reason: 'Good entry points into data teams via consulting projects' }, { name: 'Innodatatics', type: 'startup', url: 'https://innodatatics.com/careers/', reason: 'Data analytics services firm ideal for beginners building portfolio' }]
      },
      strengths_high: ['Strong understanding of machine learning algorithms and evaluation metrics', 'Demonstrated statistical thinking in problem-solving', 'Good ability to extract insights from complex data'],
      strengths_mid:  ['Solid foundational understanding of data concepts', 'Basic ML model building and evaluation skills', 'Good Python/SQL proficiency'],
      strengths_low:  ['Interest in data-driven thinking is evident', 'Basic analytical skills present', 'Understands core data science terminology'],
      weaknesses_high: ['Deep learning proficiency could be improved', 'Experiment tracking and MLOps understanding worth developing', 'Presentation of insights to non-technical stakeholders'],
      weaknesses_mid:  ['Statistical depth needs strengthening', 'Hands-on Kaggle competition experience recommended', 'Need more real-world dataset projects in portfolio'],
      weaknesses_low:  ['Core Python and SQL skills must be solidified', 'Needs to build first complete end-to-end ML project', 'Understanding of model evaluation and validation is weak'],
    },

    'Product Manager': {
      skills: [
        { skill: 'Product Strategy & Roadmapping', reason: 'Core PM skill — required at every level and every interview', url: 'https://www.productplan.com/learn/what-is-a-product-roadmap/', tag: 'ProductPlan Guide (Free)' },
        { skill: 'User Research & Interviews', reason: 'PMs who understand users build better products', url: 'https://www.nngroup.com/articles/user-interviews/', tag: 'Nielsen Norman Group' },
        { skill: 'Data-Driven Decision Making', reason: 'Modern PMs are expected to work with metrics and analytics', url: 'https://www.coursera.org/learn/data-driven-decision-making', tag: 'Coursera (Audit Free)' },
        { skill: 'Agile & Scrum Framework', reason: 'Most tech teams run on Agile — PMs must master it', url: 'https://www.atlassian.com/agile/scrum', tag: 'Atlassian Agile Guide' },
        { skill: 'Wireframing with Figma', reason: 'PMs who can prototype ideas get better traction with design teams', url: 'https://www.figma.com/resources/learn-design/', tag: 'Figma Learn (Free)' },
        { skill: 'Stakeholder Communication', reason: 'Communicating across engineering, design, and business is essential', url: 'https://www.mindtools.com/pages/article/stakeholder-analysis.htm', tag: 'MindTools Guide' },
      ],
      companies: {
        high:  [{ name: 'Swiggy', type: 'mid-size', url: 'https://careers.swiggy.com', reason: 'Fast-growing consumer tech — strong PM culture with high ownership' }, { name: 'PhonePe', type: 'mid-size', url: 'https://www.phonepe.com/careers/', reason: 'Fintech platform with deep product challenges in payments and UX' }, { name: 'Atlassian', type: 'enterprise', url: 'https://www.atlassian.com/company/careers', reason: 'Developer-tools company that values PMs with technical understanding' }],
        mid:   [{ name: 'Paytm', type: 'mid-size', url: 'https://paytm.com/about/job-openings/', reason: 'Large India fintech with multiple product verticals' }, { name: 'MakeMyTrip', type: 'mid-size', url: 'https://careers.makemytrip.com/', reason: 'Travel tech with classic B2C product challenges — good PM growth' }, { name: 'Nykaa', type: 'mid-size', url: 'https://www.nykaa.com/careers', reason: 'E-commerce beauty platform with strong consumer product focus' }],
        low:   [{ name: 'Internshala', type: 'startup', url: 'https://internshala.com/jobs/', reason: 'Great for entry-level APM roles with learning-oriented teams' }, { name: 'Sprinklr', type: 'mid-size', url: 'https://www.sprinklr.com/careers/', reason: 'SaaS platform with structured APM programs' }, { name: 'Razorpay APM', type: 'mid-size', url: 'https://razorpay.com/jobs/', reason: 'Well-known APM program for early-career PMs' }]
      },
      strengths_high: ['Strong understanding of product lifecycle and go-to-market strategy', 'Clear prioritization skills demonstrated through quiz results', 'Strong communication and stakeholder alignment ability'],
      strengths_mid:  ['Good grasp of agile ceremonies and sprint planning', 'Understands MVPs and feature prioritization basics', 'User empathy apparent in interview responses'],
      strengths_low:  ['Shows genuine interest in user-centric thinking', 'Basic familiarity with product tools', 'Curious mindset ideal for learning PM craft'],
      weaknesses_high: ['Strengthen data analysis and SQL querying skills', 'Practice mock PM interviews (case studies)', 'Build deeper experience with OKR setting and tracking'],
      weaknesses_mid:  ['Needs more hands-on experience with real product scenarios', 'Data-driven storytelling needs improvement', 'Sharpen knowledge of A/B testing methodologies'],
      weaknesses_low:  ['Must build clarity on core PM frameworks (RICE, MoSCoW)', 'Needs to complete a product case study from scratch', 'Interview answers lack structure — practice the STAR method'],
    },

    'Frontend Developer': {
      skills: [
        { skill: 'React.js (Hooks & Context)', reason: 'React dominates the frontend job market — deep knowledge is essential', url: 'https://react.dev/learn', tag: 'Official React Docs (Free)' },
        { skill: 'CSS & Responsive Design', reason: 'Pixel-perfect, mobile-friendly UIs are non-negotiable', url: 'https://web.dev/learn/css/', tag: 'web.dev CSS Course (Google, Free)' },
        { skill: 'JavaScript (ES6+)', reason: 'Mastering modern JS is the foundation of all frontend work', url: 'https://javascript.info/', tag: 'javascript.info (Free)' },
        { skill: 'TypeScript', reason: 'Most mid-to-large companies now require TypeScript proficiency', url: 'https://www.typescriptlang.org/docs/', tag: 'TypeScript Official Docs' },
        { skill: 'Performance Optimization', reason: 'Core Web Vitals and page load speed are critical in 2024', url: 'https://web.dev/explore/fast', tag: 'web.dev Performance (Google)' },
        { skill: 'Testing (Jest + React Testing Library)', reason: 'Untested UI code is a liability — testing is expected in senior roles', url: 'https://testing-library.com/docs/react-testing-library/intro/', tag: 'Testing Library Docs' },
      ],
      companies: {
        high:  [{ name: 'Groww', type: 'mid-size', url: 'https://groww.in/careers', reason: 'Fintech with extremely polished frontend — ideal for senior React devs' }, { name: 'Zepto', type: 'startup', url: 'https://zepto.teamtailor.com/', reason: 'Fast-growing quick-commerce with aggressive frontend hiring' }, { name: 'Shopify', type: 'enterprise', url: 'https://www.shopify.com/careers', reason: 'World-class frontend engineering with strong React/TypeScript culture' }],
        mid:   [{ name: 'Meesho', type: 'mid-size', url: 'https://meesho.io/careers', reason: 'Social commerce with complex frontend product challenges' }, { name: 'Urban Company', type: 'mid-size', url: 'https://careers.urbancompany.com/', reason: 'Consumer app with strong UI focus and growing frontend team' }, { name: 'Cred', type: 'startup', url: 'https://cred.club/careers', reason: 'Known for exceptional UI/UX — excellent environment for frontend devs' }],
        low:   [{ name: 'Uplers', type: 'startup', url: 'https://www.uplers.com/careers/', reason: 'Remote-first agency — good for building frontend portfolio quickly' }, { name: 'HCL Technologies', type: 'enterprise', url: 'https://www.hcltech.com/careers', reason: 'Large IT firm with steady frontend project opportunities' }, { name: 'BrowserStack', type: 'mid-size', url: 'https://www.browserstack.com/careers', reason: 'Testing infrastructure company with strong frontend engineering team' }]
      },
      strengths_high: ['Excellent command of React and modern JavaScript ecosystem', 'Strong visual and layout problem-solving demonstrated', 'Solid understanding of browser rendering and performance'],
      strengths_mid:  ['Good HTML/CSS/JS fundamentals', 'Understands component-based architecture', 'Comfortable with responsive design principles'],
      strengths_low:  ['Familiarity with basic HTML & CSS', 'Willing to learn modern frameworks', 'Good eye for visual design'],
      weaknesses_high: ['TypeScript adoption could strengthen maintainability of code', 'Improve unit testing habits', 'Explore accessibility (ARIA) best practices'],
      weaknesses_mid:  ['JavaScript fundamentals (closures, async) need more depth', 'Need more real-world React project practice', 'Performance and optimization concepts need work'],
      weaknesses_low:  ['Must build first complete responsive website from scratch', 'JavaScript basics must be thoroughly mastered', 'Framework knowledge is lacking — start with React fundamentals'],
    },

    'Backend Developer': {
      skills: [
        { skill: 'Node.js & Express.js', reason: 'Most widely used backend stack in startups and scale-ups', url: 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs', tag: 'Node.js Official Docs' },
        { skill: 'Database Design (SQL & NoSQL)', reason: 'Data modeling is fundamental to every backend system', url: 'https://www.postgresql.org/docs/current/tutorial.html', tag: 'PostgreSQL Tutorial (Free)' },
        { skill: 'REST & GraphQL API Design', reason: 'Building and consuming APIs is the core of backend development', url: 'https://graphql.org/learn/', tag: 'GraphQL Official Guide' },
        { skill: 'Authentication & Security (JWT/OAuth)', reason: 'Security is now a baseline requirement — not optional', url: 'https://auth0.com/docs/get-started', tag: 'Auth0 Docs (Free)' },
        { skill: 'Caching with Redis', reason: 'Redis is used at nearly every high-traffic backend system', url: 'https://redis.io/learn/', tag: 'Redis Learn (Free)' },
        { skill: 'System Design for Backend', reason: 'Understanding load balancers, queues and microservices separates good from great', url: 'https://github.com/donnemartin/system-design-primer', tag: 'System Design Primer' },
      ],
      companies: {
        high:  [{ name: 'Juspay', type: 'startup', url: 'https://juspay.in/careers', reason: 'High-scale payments backend engineering with Haskell/Java — top-tier tech' }, { name: 'Dunzo', type: 'startup', url: 'https://www.dunzo.com/careers', reason: 'Real-time logistics platform with complex backend challenges' }, { name: 'AWS (India)', type: 'enterprise', url: 'https://amazon.jobs/en/teams/aws', reason: 'World-class distributed systems engineering environment' }],
        mid:   [{ name: 'Postman', type: 'mid-size', url: 'https://www.postman.com/careers/', reason: 'API-first tooling company — ideal for backend devs' }, { name: 'HashedIn by Deloitte', type: 'mid-size', url: 'https://hashedin.com/careers/', reason: 'Product engineering company with solid backend projects' }, { name: 'Chargebee', type: 'mid-size', url: 'https://www.chargebee.com/careers/', reason: 'SaaS billing platform with complex transactional backend systems' }],
        low:   [{ name: 'Mindtree', type: 'enterprise', url: 'https://www.mindtree.com/careers', reason: 'Good backend exposure through enterprise client projects' }, { name: 'Persistent Systems', type: 'enterprise', url: 'https://www.persistent.com/careers/', reason: 'Technology company with structured backend engineering training' }, { name: 'Nagarro', type: 'mid-size', url: 'https://www.nagarro.com/en/careers', reason: 'Fast-growing digital engineering firm with backend openings' }]
      },
      strengths_high: ['Deep understanding of API design and database systems', 'Strong security-first thinking demonstrated', 'Excellent understanding of scalable architecture patterns'],
      strengths_mid:  ['Solid grasp of core backend concepts like REST and databases', 'Good understanding of authentication patterns', 'Comfortable with server-side logic'],
      strengths_low:  ['Basic understanding of how web servers work', 'Familiarity with at least one backend language', 'Good foundation for structured learning'],
      weaknesses_high: ['Improve knowledge of event-driven architecture and message queues', 'Explore Kubernetes and container orchestration', 'Deepen understanding of database query optimization'],
      weaknesses_mid:  ['Redis and caching strategies are weak', 'Need more API versioning and security depth', 'Build a complete backend project with auth, DB, and tests'],
      weaknesses_low:  ['Must learn HTTP fundamentals and REST thoroughly', 'Database design basics need solid practice', 'Start with building a simple CRUD API from scratch'],
    },

    'Full Stack Developer': {
      skills: [
        { skill: 'React.js + Node.js (MERN Stack)', reason: 'Full stack roles expect end-to-end product building ability', url: 'https://www.mongodb.com/mern-stack', tag: 'MongoDB MERN Guide' },
        { skill: 'Docker & Containerization', reason: 'Full stack developers are expected to deploy their own apps today', url: 'https://docs.docker.com/get-started/', tag: 'Docker Getting Started' },
        { skill: 'PostgreSQL & MongoDB', reason: 'Knowing both SQL and NoSQL makes you versatile across roles', url: 'https://www.postgresqltutorial.com/', tag: 'PostgreSQL Tutorial (Free)' },
        { skill: 'CI/CD Pipelines (GitHub Actions)', reason: 'Automate builds and deployments — expected in modern teams', url: 'https://docs.github.com/en/actions', tag: 'GitHub Actions Docs' },
        { skill: 'TypeScript (Frontend + Backend)', reason: 'Type safety across the stack greatly reduces bugs in collaboration', url: 'https://www.typescriptlang.org/docs/handbook/intro.html', tag: 'TypeScript Handbook' },
        { skill: 'GraphQL & REST APIs', reason: 'Handling data on both sides of the stack is core to full-stack work', url: 'https://graphql.org/learn/', tag: 'GraphQL Official Docs' },
      ],
      companies: {
        high:  [{ name: 'Notion', type: 'mid-size', url: 'https://www.notion.so/careers', reason: 'Product-led company that values full-stack ownership and initiative' }, { name: 'Vercel', type: 'startup', url: 'https://vercel.com/careers', reason: 'Frontend infrastructure company — ideal for JS full-stack devs' }, { name: 'Supabase', type: 'startup', url: 'https://supabase.com/careers', reason: 'Open-source Firebase alternative — full-stack expertise highly valued' }],
        mid:   [{ name: 'Lenskart', type: 'mid-size', url: 'https://lenskart.com/careers', reason: 'India-based consumer brand with strong full-stack product teams' }, { name: 'upGrad', type: 'mid-size', url: 'https://careers.upgrad.com/', reason: 'EdTech company with complex full-stack engineering work' }, { name: 'Shiprocket', type: 'startup', url: 'https://www.shiprocket.in/careers/', reason: 'Logistics tech company scaling fast with full-stack needs' }],
        low:   [{ name: 'freeCodeCamp Contributor', type: 'startup', url: 'https://contribute.freecodecamp.org/', reason: 'Contribute to open-source while building your full-stack portfolio' }, { name: 'Toptal', type: 'enterprise', url: 'https://www.toptal.com/full-stack-developer-jobs', reason: 'Freelance platform for remote full-stack projects once basics are solid' }, { name: 'Hexaware Technologies', type: 'enterprise', url: 'https://hexaware.com/careers/', reason: 'IT company with entry-level full-stack opportunities' }]
      },
      strengths_high: ['Comfortable across the entire development stack', 'Strong deployment and DevOps awareness', 'Excellent product ownership and delivery mindset'],
      strengths_mid:  ['Good at bridging frontend and backend concerns', 'Understands the full request-response cycle', 'Comfortable with both UI and API work'],
      strengths_low:  ['Broad curiosity across tech layers', 'Basic familiarity with frontend and backend tools', 'Good learning mindset for full-stack growth'],
      weaknesses_high: ['Deepen knowledge of distributed systems at scale', 'Improve testing coverage (unit + integration)', 'Explore infrastructure-as-code (Terraform)'],
      weaknesses_mid:  ['Docker and deployment workflows need strengthening', 'TypeScript on both frontend and backend is a priority', 'Need more complex real-world projects to demonstrate depth'],
      weaknesses_low:  ['Must pick one stack (MERN/MEAN) and build a complete project', 'Frontend and backend knowledge are both shallow — focus on depth first', 'Learn deployment to Vercel/Heroku as a starting point'],
    },

    'DevOps Engineer': {
      skills: [
        { skill: 'Docker & Kubernetes', reason: 'Container orchestration is the #1 skill in modern DevOps', url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/', tag: 'Kubernetes Official Tutorial' },
        { skill: 'Terraform (Infrastructure as Code)', reason: 'IaC is now standard for all cloud infrastructure management', url: 'https://developer.hashicorp.com/terraform/tutorials', tag: 'HashiCorp Terraform Tutorials' },
        { skill: 'CI/CD (GitHub Actions / Jenkins)', reason: 'Automating pipelines is the core of every DevOps job', url: 'https://docs.github.com/en/actions/learn-github-actions', tag: 'GitHub Actions Docs' },
        { skill: 'Linux & Bash Scripting', reason: 'Deep Linux knowledge is essential for any server/infrastructure role', url: 'https://linuxcommand.org/lc3_learning_the_shell.php', tag: 'Linux Command (Free)' },
        { skill: 'AWS / GCP Cloud Services', reason: 'Cloud certifications dramatically improve DevOps job market value', url: 'https://aws.amazon.com/certification/', tag: 'AWS Certification Guide' },
        { skill: 'Monitoring (Prometheus + Grafana)', reason: 'Observability is critical for production system health', url: 'https://grafana.com/tutorials/', tag: 'Grafana Tutorials (Free)' },
      ],
      companies: {
        high:  [{ name: 'Netflix Technology', type: 'enterprise', url: 'https://jobs.netflix.com', reason: 'Pioneered chaos engineering and advanced DevOps — best-in-class for senior DevOps' }, { name: 'CloudSEK', type: 'startup', url: 'https://cloudsek.com/careers', reason: 'Cybersecurity startup with strong DevOps and cloud security practice' }, { name: 'Razorpay DevOps', type: 'mid-size', url: 'https://razorpay.com/jobs/', reason: 'High-scale payment infrastructure with excellent DevOps engineering culture' }],
        mid:   [{ name: 'Akamai Technologies', type: 'enterprise', url: 'https://www.akamai.com/careers', reason: 'CDN and cloud company — ideal DevOps environment for mid-level engineers' }, { name: 'Clarisights', type: 'startup', url: 'https://clarisights.com/careers/', reason: 'Data platform startup with modern DevOps stack' }, { name: 'Indeed India', type: 'mid-size', url: 'https://indeed.com/cmp/Indeed/jobs', reason: 'Job platform with solid infrastructure engineering team' }],
        low:   [{ name: 'NTT Data', type: 'enterprise', url: 'https://www.nttdata.com/global/en/careers', reason: 'Good structured DevOps training for entry-level engineers' }, { name: 'Mphasis', type: 'enterprise', url: 'https://www.mphasis.com/careers.html', reason: 'IT firm with cloud and DevOps service lines for freshers' }, { name: 'Xoriant', type: 'mid-size', url: 'https://www.xoriant.com/careers', reason: 'Engineering and technology solutions firm with DevOps team' }]
      },
      strengths_high: ['Strong cloud infrastructure knowledge', 'Good understanding of CI/CD pipeline design', 'Security-conscious approach to systems management'],
      strengths_mid:  ['Comfortable with Docker and basic Kubernetes', 'Understands Linux administration', 'Familiar with cloud fundamentals'],
      strengths_low:  ['Basic awareness of DevOps concepts and terminology', 'Interest in automation and infrastructure', 'Good foundation for structured DevOps training'],
      weaknesses_high: ['Deepen SRE practices — SLOs, SLAs, error budgets', 'Expand multi-cloud (AWS + GCP) knowledge', 'Explore FinOps and cloud cost optimization'],
      weaknesses_mid:  ['Terraform and IaC need more hands-on practice', 'Monitoring and alerting setup needs work', 'Kubernetes at scale (stateful sets, networking) needs improvement'],
      weaknesses_low:  ['Must start with Linux and Bash fundamentals', 'Learn Docker from scratch — build and deploy a containerized app', 'Get AWS Cloud Practitioner certification as first milestone'],
    },

    'UI/UX Designer': {
      skills: [
        { skill: 'Figma (Prototyping & Design Systems)', reason: 'Figma is the industry standard for UI design — mastery is non-negotiable', url: 'https://help.figma.com/hc/en-us/categories/360002051613-Getting-started', tag: 'Figma Official Tutorials' },
        { skill: 'User Research Methods', reason: 'Designs backed by user research create better products', url: 'https://www.nngroup.com/articles/which-ux-research-methods/', tag: 'Nielsen Norman Group (Free)' },
        { skill: 'Accessibility (WCAG Guidelines)', reason: 'Inclusive design is now mandated by many governments and companies', url: 'https://www.w3.org/WAI/WCAG21/quickref/', tag: 'W3C WCAG Quick Reference' },
        { skill: 'Design Systems (Atomic Design)', reason: 'Scalable design systems are expected in mid-to-large product teams', url: 'https://atomicdesign.bradfrost.com/', tag: 'Atomic Design by Brad Frost' },
        { skill: 'Usability Testing', reason: 'Validating designs with real users reduces costly rework', url: 'https://www.usability.gov/how-to-and-tools/methods/usability-testing.html', tag: 'Usability.gov Guide' },
        { skill: 'Motion Design (Principle / After Effects)', reason: 'Micro-animations and transitions are now expected in premium products', url: 'https://www.youtube.com/c/DesignCourse', tag: 'DesignCourse YouTube (Free)' },
      ],
      companies: {
        high:  [{ name: 'Cred', type: 'startup', url: 'https://cred.club/careers', reason: "Known for India's best UI/UX — highly competitive, perfect for senior designers" }, { name: 'Zeta', type: 'startup', url: 'https://zeta.tech/careers', reason: 'Banking and fintech with extraordinary design standards' }, { name: 'Figma (Global)', type: 'enterprise', url: 'https://figma.com/careers', reason: 'The design tool company itself — ultimate destination for top UX designers' }],
        mid:   [{ name: 'Myntra', type: 'mid-size', url: 'https://careers.myntra.com/', reason: 'Fashion e-commerce with strong design culture and Dresscode design system' }, { name: 'Juspay', type: 'startup', url: 'https://juspay.in/careers', reason: 'Payment UX is a craft — Juspay values design excellence' }, { name: 'Clevertap', type: 'mid-size', url: 'https://clevertap.com/company/careers/', reason: 'Marketing SaaS with complex dashboard and data visualization design' }],
        low:   [{ name: 'Designshack', type: 'startup', url: 'https://designshack.net', reason: 'Online platform to build design portfolio with tutorials' }, { name: 'Toptal Design', type: 'enterprise', url: 'https://www.toptal.com/designers', reason: 'Freelance platform for UX designers once portfolio is ready' }, { name: 'Razorpay Design Team', type: 'mid-size', url: 'https://razorpay.com/jobs/', reason: 'Product design internships and junior openings available regularly' }]
      },
      strengths_high: ['Strong visual hierarchy and layout design skills', 'Deep understanding of user-centered design principles', 'Excellent prototyping and stakeholder communication ability'],
      strengths_mid:  ['Good Figma skills and component mindset', 'Understands user flows and usability basics', 'Comfortable with design critique and iteration'],
      strengths_low:  ['Good eye for visual aesthetics', 'Basic Figma or design tool familiarity', 'Eager to learn UI standards and patterns'],
      weaknesses_high: ['Motion design and interaction animation could be stronger', 'Explore design system governance and contribution', 'Deepen knowledge of accessibility and inclusive design'],
      weaknesses_mid:  ['User research execution (conducting interviews) needs practice', 'Figma auto-layout and components need deeper knowledge', 'Portfolio case studies should show full design thinking process'],
      weaknesses_low:  ['Must complete first full design project with user research and testing', 'Figma fundamentals must be thoroughly practiced', 'Build a 3-project portfolio before applying to junior roles'],
    },

    'Machine Learning Engineer': {
      skills: [
        { skill: 'PyTorch for Deep Learning', reason: 'PyTorch dominates ML research and production at most top companies', url: 'https://pytorch.org/tutorials/', tag: 'PyTorch Official Tutorials' },
        { skill: 'MLOps (MLflow + DVC)', reason: 'Production ML requires versioning, tracking and deployment skills', url: 'https://mlflow.org/docs/latest/index.html', tag: 'MLflow Docs (Free)' },
        { skill: 'Feature Engineering & EDA', reason: 'Data quality determines model quality — this skill is underrated', url: 'https://www.kaggle.com/learn/feature-engineering', tag: 'Kaggle Feature Engineering' },
        { skill: 'Transformer Architecture (NLP)', reason: 'LLMs and transformers are reshaping every ML product', url: 'https://huggingface.co/learn/nlp-course/chapter1/1', tag: 'Hugging Face NLP Course (Free)' },
        { skill: 'Model Deployment (FastAPI + Docker)', reason: 'MLE must be able to ship models as APIs — not just train them', url: 'https://fastapi.tiangolo.com/tutorial/', tag: 'FastAPI Official Docs' },
        { skill: 'Mathematics (Linear Algebra + Calculus)', reason: 'Understanding math behind ML separates engineers from practitioners', url: 'https://www.khanacademy.org/math/linear-algebra', tag: 'Khan Academy Linear Algebra (Free)' },
      ],
      companies: {
        high:  [{ name: 'Google DeepMind (India)', type: 'enterprise', url: 'https://deepmind.google/about/careers/', reason: 'World leader in AI research — suitable for exceptional ML engineers' }, { name: 'Sarvam AI', type: 'startup', url: 'https://www.sarvam.ai/careers', reason: 'Indian language AI startup — cutting-edge NLP with strong mission' }, { name: 'InMobi', type: 'mid-size', url: 'https://www.inmobi.com/company/careers/', reason: 'Ad-tech with sophisticated ML for targeting and personalization' }],
        mid:   [{ name: 'Uniphore', type: 'mid-size', url: 'https://www.uniphore.com/company/careers/', reason: 'Conversational AI company with real-world NLP use cases' }, { name: 'Wadhwani AI', type: 'startup', url: 'https://www.wadhwaniai.org/careers', reason: 'AI for social good — health and agriculture ML models' }, { name: 'Locus.sh', type: 'startup', url: 'https://locus.sh/careers/', reason: 'Supply chain AI with complex optimization and routing ML' }],
        low:   [{ name: 'Kaggle Competition', type: 'startup', url: 'https://www.kaggle.com/competitions', reason: 'Build portfolio by competing in ML challenges before applying to jobs' }, { name: 'Analytics Vidhya Jobs', type: 'mid-size', url: 'https://www.analyticsvidhya.com/jobs/', reason: 'Platform listing ML jobs suited to all levels in India' }, { name: 'Sigmoid Analytics', type: 'mid-size', url: 'https://www.sigmoid.com/careers/', reason: 'Data engineering and ML services firm with entry-level openings' }]
      },
      strengths_high: ['Deep understanding of neural network architectures', 'Good grasp of optimization and loss function theory', 'Strong ability to implement and tune production ML models'],
      strengths_mid:  ['Comfortable with standard ML algorithms and evaluation', 'Good Python and data manipulation skills', 'Understands the training-validation-test pipeline'],
      strengths_low:  ['Interest in AI and machine learning is clear', 'Basic understanding of supervised learning concepts', 'Good starting foundation for structured ML learning'],
      weaknesses_high: ['Improve MLOps and model monitoring skills', 'Deepen knowledge of transformers and attention mechanisms', 'Explore reinforcement learning and its production applications'],
      weaknesses_mid:  ['Deep learning frameworks (PyTorch) need more practice', 'Model deployment and serving knowledge is weak', 'Need to complete at least 2 Kaggle competitions for experience'],
      weaknesses_low:  ['Must master Python and NumPy/Pandas fundamentals first', 'Complete fast.ai or Andrew Ng ML course before job hunting', 'Build first end-to-end ML project with a real dataset'],
    },

    'Android Developer': {
      skills: [
        { skill: 'Kotlin & Coroutines', reason: 'Kotlin is now the primary language for Android — coroutines are essential for async code', url: 'https://developer.android.com/kotlin/coroutines', tag: 'Android Developers (Official)' },
        { skill: 'Jetpack Compose', reason: 'Google has replaced XML layouts with Compose — it is the future of Android UI', url: 'https://developer.android.com/jetpack/compose/tutorial', tag: 'Jetpack Compose Tutorial' },
        { skill: 'MVVM + Clean Architecture', reason: 'Scalable Android apps require proper architecture patterns', url: 'https://developer.android.com/topic/architecture', tag: 'Android Architecture Guide' },
        { skill: 'Retrofit & OkHttp (Networking)', reason: 'REST API integration is core to virtually every Android app', url: 'https://square.github.io/retrofit/', tag: 'Retrofit Docs' },
        { skill: 'Room Database', reason: 'Local data persistence using Room is an expected Android skill', url: 'https://developer.android.com/training/data-storage/room', tag: 'Room Persistence Docs' },
        { skill: 'Firebase (Auth + Firestore)', reason: 'Firebase services accelerate app development and are widely used', url: 'https://firebase.google.com/docs/android/setup', tag: 'Firebase Android Docs' },
      ],
      companies: {
        high:  [{ name: 'PhonePe', type: 'mid-size', url: 'https://www.phonepe.com/careers/', reason: "India's largest payment app — demands top-tier Android engineering" }, { name: 'Dream11', type: 'mid-size', url: 'https://www.dream11.com/careers.html', reason: 'High-scale fantasy sports platform with millions of concurrent Android users' }, { name: 'Google India', type: 'enterprise', url: 'https://careers.google.com', reason: 'Core Android team contributions and high-impact mobile product work' }],
        mid:   [{ name: 'ShareChat', type: 'mid-size', url: 'https://sharechat.com/careers', reason: 'Social media platform for Bharat — strong Android-first product' }, { name: 'Dailyhunt', type: 'mid-size', url: 'https://www.dailyhunt.in/careers', reason: 'News + content app with large Android user base in India' }, { name: 'Navi', type: 'startup', url: 'https://www.navi.com/careers/', reason: 'Fintech startup with great Android engineering team' }],
        low:   [{ name: 'Tekion Corp', type: 'mid-size', url: 'https://tekion.com/company/careers', reason: 'Automotive SaaS with structured Android development programs' }, { name: 'Fynd', type: 'startup', url: 'https://careers.fynd.com/', reason: 'Commerce OS startup with entry-level Android openings' }, { name: 'GameDuell India', type: 'startup', url: 'https://www.gameduell.in', reason: 'Mobile gaming company suitable for entry-level Android devs' }]
      },
      strengths_high: ['Strong Kotlin and coroutines mastery', 'Excellent Jetpack Compose and Material Design knowledge', 'Clear architecture thinking with MVVM or Clean Architecture'],
      strengths_mid:  ['Comfortable building Android apps with Activities and Fragments', 'Good understanding of Android lifecycle', 'Familiar with network calls and REST integration'],
      strengths_low:  ['Basic Android project setup and understanding', 'Familiar with XML layouts', 'Good interest in mobile development'],
      weaknesses_high: ['Explore multi-module architecture for large apps', 'Improve CI/CD for Android (Fastlane, GitHub Actions)', 'Contribute to open-source Android libraries'],
      weaknesses_mid:  ['Migrate from XML to Jetpack Compose', 'Strengthen Hilt dependency injection knowledge', 'Learn unit and UI testing with Espresso'],
      weaknesses_low:  ['Build first complete Android app published to Play Store', 'Learn Kotlin fundamentals thoroughly before frameworks', 'Complete Udacity Android development course'],
    },

    'iOS Developer': {
      skills: [
        { skill: 'Swift & Swift Concurrency (async/await)', reason: 'Modern Swift with structured concurrency is now the standard for iOS', url: 'https://docs.swift.org/swift-book/', tag: 'Swift Official Book (Free)' },
        { skill: 'SwiftUI', reason: "Apple's declarative UI framework replaces UIKit for most new apps", url: 'https://developer.apple.com/tutorials/swiftui/', tag: 'Apple SwiftUI Tutorials' },
        { skill: 'Combine Framework (Reactive)', reason: 'Reactive programming with Combine powers modern iOS data flows', url: 'https://developer.apple.com/documentation/combine', tag: 'Apple Combine Docs' },
        { skill: 'Core Data & CloudKit', reason: 'Persistence layer knowledge is required for data-heavy iOS apps', url: 'https://developer.apple.com/documentation/coredata', tag: 'Core Data Docs' },
        { skill: 'App Store Submission & TestFlight', reason: 'Shipping apps through App Store is an expected senior iOS skill', url: 'https://developer.apple.com/testflight/', tag: 'Apple TestFlight Guide' },
        { skill: 'Instruments (Performance Profiling)', reason: 'Memory leaks and battery drain are top app review rejection reasons', url: 'https://developer.apple.com/forums/tags/instruments', tag: 'Apple Developer Forums' },
      ],
      companies: {
        high:  [{ name: 'Swiggy', type: 'mid-size', url: 'https://careers.swiggy.com', reason: 'Consumer app with very high iOS engineering standards and scale' }, { name: 'Apple India', type: 'enterprise', url: 'https://www.apple.com/jobs/in/', reason: 'Contribute to Apple platform developer tools and core iOS SDK' }, { name: 'Zomato', type: 'mid-size', url: 'https://www.zomato.com/careers', reason: 'Food-tech leader with complex iOS real-time delivery features' }],
        mid:   [{ name: 'Ola', type: 'mid-size', url: 'https://www.olacabs.com/careers', reason: 'Ride-hailing super-app with strong iOS engineering team' }, { name: 'Practo', type: 'mid-size', url: 'https://practojobs.com/', reason: 'HealthTech with complex iOS patient and doctor apps' }, { name: 'Slice', type: 'startup', url: 'https://sliceit.com/careers', reason: 'Fintech startup with a beautiful and performant iOS app' }],
        low:   [{ name: 'Codecademy iOS Track', type: 'startup', url: 'https://www.codecademy.com/learn/learn-swift', reason: 'Build your Swift skills with structured guided projects' }, { name: 'Outcome Health', type: 'mid-size', url: 'https://www.outcomehealth.com/careers', reason: 'HealthTech with iOS app development roles' }, { name: 'Gojek India', type: 'mid-size', url: 'https://www.gojek.com/en-id/careers/', reason: 'Super-app platform with structured iOS onboarding for junior devs' }]
      },
      strengths_high: ['Strong Swift and SwiftUI expertise', 'Clear understanding of Apple design guidelines (HIG)', 'Excellent app performance awareness using Instruments'],
      strengths_mid:  ['Good foundational Swift programming', 'Comfortable with UIKit and basic SwiftUI', 'Understands iOS app lifecycle well'],
      strengths_low:  ['Basic Swift syntax knowledge', 'Familiar with Xcode environment', 'Good curiosity about Apple platform development'],
      weaknesses_high: ['Explore SwiftUI + Combine deeper integration patterns', 'Contribute to open-source iOS frameworks on GitHub', 'Improve knowledge of App Store optimization (ASO)'],
      weaknesses_mid:  ['Transition from UIKit to SwiftUI more aggressively', 'Implement proper async/await concurrency in projects', 'Ship a complete app to the App Store as portfolio piece'],
      weaknesses_low:  ['Complete Apple SwiftUI tutorials from scratch', 'Build and publish first iOS app to App Store', 'Study Apple Human Interface Guidelines thoroughly'],
    },

    'QA Engineer': {
      skills: [
        { skill: 'Selenium & WebDriver', reason: 'Most widely used browser automation framework in the industry', url: 'https://www.selenium.dev/documentation/', tag: 'Selenium Official Docs' },
        { skill: 'API Testing with Postman', reason: 'API testing is now a core QA skill at every software company', url: 'https://learning.postman.com/docs/getting-started/introduction/', tag: 'Postman Learning Center' },
        { skill: 'Test Automation Framework Design', reason: 'Writing maintainable, scalable test frameworks separates senior QA', url: 'https://testng.org/doc/', tag: 'TestNG Docs' },
        { skill: 'Performance Testing (JMeter)', reason: 'Load testing is expected in QA roles at any company with scale', url: 'https://jmeter.apache.org/usermanual/get-started.html', tag: 'Apache JMeter Guide' },
        { skill: 'SQL for QA (Test Data Management)', reason: 'Writing SQL queries to verify data integrity is a critical QA skill', url: 'https://sqlzoo.net/', tag: 'SQLZoo (Free Interactive)' },
        { skill: 'Behavior-Driven Development (Cucumber)', reason: 'BDD connects QA with business requirements — expected at product companies', url: 'https://cucumber.io/docs/guides/10-minute-tutorial/', tag: 'Cucumber 10-min Tutorial' },
      ],
      companies: {
        high:  [{ name: 'Browserstack', type: 'mid-size', url: 'https://www.browserstack.com/careers', reason: 'The leading cross-browser testing platform — ideal for senior QA engineers' }, { name: 'Microsoft India SDET', type: 'enterprise', url: 'https://careers.microsoft.com', reason: 'Large-scale SDET/QA roles with cutting-edge automation tools' }, { name: 'Atlassian India', type: 'enterprise', url: 'https://www.atlassian.com/company/careers', reason: 'Developer tools with excellent QA engineering culture' }],
        mid:   [{ name: 'Testlio', type: 'mid-size', url: 'https://testlio.com/company/careers/', reason: 'QA-as-a-service company — great for experienced QA engineers' }, { name: 'Mfine', type: 'startup', url: 'https://mfine.co/careers/', reason: 'HealthTech startup with complex testing challenges across platforms' }, { name: 'Darwinbox', type: 'mid-size', url: 'https://darwinbox.com/careers', reason: 'HR SaaS with growing QA automation team' }],
        low:   [{ name: 'QA Wolf', type: 'startup', url: 'https://www.qawolf.com/careers', reason: 'QA automation company with structured entry-level programs' }, { name: 'Testbook', type: 'startup', url: 'https://testbook.com/careers', reason: 'EdTech with entry-level SDET positions' }, { name: 'Mphasis QA Practice', type: 'enterprise', url: 'https://www.mphasis.com/careers.html', reason: 'IT firm with structured QA onboarding and certification paths' }]
      },
      strengths_high: ['Strong test strategy and risk-based testing mindset', 'Excellent automation framework design knowledge', 'Good at performance, security and regression testing'],
      strengths_mid:  ['Comfortable with basic test case design and execution', 'Familiar with SDLC and bug lifecycle management', 'Good API testing fundamentals with Postman'],
      strengths_low:  ['Understanding of QA basics and test planning', 'Familiarity with bug reporting tools (Jira, Bugzilla)', 'Good attention to detail for manual testing'],
      weaknesses_high: ['Explore AI-powered test generation tools', 'Improve CI/CD integration with test automation pipelines', 'Deepen security testing and penetration testing knowledge'],
      weaknesses_mid:  ['Build first Selenium + TestNG automation framework', 'SQL query writing for test data verification needs improvement', 'Performance testing with JMeter needs hands-on practice'],
      weaknesses_low:  ['Must strengthen SQL for data-layer verification', 'Build first automated test suite even for a simple web page', 'Get ISTQB Foundation Level certification as first milestone'],
    },
  };

  // ── MATCH POSITION ──────────────────────────────────────────────────────────
  const KEY = Object.keys(SKILLS_DB).find(k => k.toLowerCase() === pos.toLowerCase()) || 'Software Engineer';
  const data = SKILLS_DB[KEY];

  // ── PICK TOP 3 SKILLS (shuffle for variety) ─────────────────────────────────
  const shuffledSkills = data.skills.sort(() => Math.random() - 0.5).slice(0, 3);
  const improvements = shuffledSkills.map(s => ({
    skill: s.skill,
    reason: s.reason,
    url: s.url,
    resource: `${s.tag} → ${s.url}`
  }));

  // ── COMPANIES ───────────────────────────────────────────────────────────────
  const suitableCompanies = data.companies[tier];

  // ── SCORE-ADAPTIVE STRENGTHS / WEAKNESSES ───────────────────────────────────
  const strengths = data[`strengths_${tier}`];
  const weaknesses = data[`weaknesses_${tier}`];

  // ── INDIVIDUAL SCORE INSIGHTS ───────────────────────────────────────────────
  const lowScores = [];
  if (resumeScore < 60) lowScores.push('resume presentation');
  if (quizScore < 60) lowScores.push('technical knowledge');
  if (interviewScore < 60) lowScores.push('interview communication');

  const nextSteps = tier === 'high'
    ? `Excellent performance across all assessment areas! Focus on ${improvements[0].skill} and ${improvements[1].skill} to reach the next career level. Apply with confidence to mid-level and senior positions at top-tier companies listed above.`
    : tier === 'mid'
    ? `Good overall performance${lowScores.length ? `, with opportunity to improve your ${lowScores.join(' and ')}` : ''}. Prioritize hands-on projects in ${improvements[0].skill} over the next 60 days and target mid-level roles. Build 2 strong portfolio projects before applying.`
    : `Focus on foundational skills: ${improvements.map(i => i.skill).join(', ')}. Spend 90 days building core competency before actively job-hunting. Starting with open-source contributions and freelance projects will significantly boost your profile.`;

  return { strengths, weaknesses, improvements, suitableCompanies, nextSteps };
}

function getUpgradeSuggestionCatalog(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();

  if (normalizedRole.includes('frontend')) {
    return [
      { title: 'roadmap.sh Frontend', url: 'https://roadmap.sh/frontend', type: 'roadmap', category: 'Frontend', why: 'Structured frontend roadmap aligned to hiring expectations.' },
      { title: 'javascript.info', url: 'https://javascript.info', type: 'website', category: 'JavaScript', why: 'Deep practical JavaScript reference for interview and project work.' },
      { title: 'web.dev', url: 'https://web.dev', type: 'articles', category: 'Performance', why: 'Modern frontend performance, accessibility, and best practices.' },
      { title: 'The Odin Project', url: 'https://www.theodinproject.com', type: 'course', category: 'Projects', why: 'Hands-on projects for portfolio building.' }
    ];
  }

  if (normalizedRole.includes('data') || normalizedRole.includes('machine learning')) {
    return [
      { title: 'roadmap.sh AI/Data Scientist', url: 'https://roadmap.sh/ai-data-scientist', type: 'roadmap', category: 'ML/AI', why: 'Clear role roadmap for ML and data roles.' },
      { title: 'fast.ai', url: 'https://www.fast.ai', type: 'course', category: 'Deep Learning', why: 'Project-based deep learning course with strong practical focus.' },
      { title: 'Kaggle Learn', url: 'https://www.kaggle.com/learn', type: 'course', category: 'Practice', why: 'Hands-on micro-courses and datasets for skill development.' },
      { title: 'Towards Data Science', url: 'https://towardsdatascience.com', type: 'blog', category: 'Articles', why: 'Good source of applied ML articles and trends.' }
    ];
  }

  if (normalizedRole.includes('devops') || normalizedRole.includes('cloud')) {
    return [
      { title: 'roadmap.sh DevOps', url: 'https://roadmap.sh/devops', type: 'roadmap', category: 'DevOps', why: 'Covers the core skills expected in DevOps interviews.' },
      { title: 'Microsoft Learn', url: 'https://learn.microsoft.com', type: 'documentation', category: 'Cloud', why: 'Structured learning paths for cloud fundamentals and deployment.' },
      { title: 'Google Cloud Skills Boost', url: 'https://cloudskillsboost.google', type: 'course', category: 'Cloud', why: 'Guided labs and role-based cloud training.' },
      { title: 'The New Stack', url: 'https://thenewstack.io', type: 'blog', category: 'Cloud-native', why: 'Ongoing industry coverage for containers, Kubernetes, and DevOps.' }
    ];
  }

  return [
    { title: 'roadmap.sh Backend', url: 'https://roadmap.sh/backend', type: 'roadmap', category: 'Backend', why: 'Structured backend roadmap for role progression.' },
    { title: 'Full Stack Open', url: 'https://fullstackopen.com', type: 'course', category: 'Projects', why: 'Strong project-based curriculum for full-stack and backend work.' },
    { title: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer', type: 'github', category: 'System Design', why: 'Widely used open-source interview prep resource.' },
    { title: 'ByteByteGo Blog', url: 'https://blog.bytebytego.com', type: 'blog', category: 'Architecture', why: 'Simple explanations for common system design patterns.' },
    { title: 'LeetCode', url: 'https://leetcode.com', type: 'practice', category: 'DSA', why: 'Required practice for coding rounds and technical screening.' }
  ];
}

function buildUpgradeSuggestionsFallback(role, candidateData = {}) {
  const weakAreas = [];
  if ((candidateData.resumeScore || 0) < 70) weakAreas.push('resume presentation');
  if ((candidateData.quizScore || 0) < 70) weakAreas.push('technical fundamentals');
  if ((candidateData.interviewScore || 0) < 70) weakAreas.push('interview communication');
  if ((candidateData.videoInterviewScore || 0) < 70 || (candidateData.uploadVideoScore || 0) < 70) weakAreas.push('video communication and confidence');

  return {
    weakAreas,
    suggestions: getUpgradeSuggestionCatalog(role).map((item) => ({
      ...item,
      why: weakAreas.length ? `${item.why} Priority area: ${weakAreas[0]}.` : item.why
    }))
  };
}

function buildUpgradeSuggestionsCacheKey(role, candidateData = {}) {
  return JSON.stringify({
    role: normalizeRoleKey(role),
    resumeScore: Number(candidateData.resumeScore) || 0,
    quizScore: Number(candidateData.quizScore) || 0,
    interviewScore: Number(candidateData.interviewScore) || 0,
    videoInterviewScore: Number(candidateData.videoInterviewScore) || 0,
    uploadVideoScore: Number(candidateData.uploadVideoScore) || 0
  });
}

function findCandidateForUpgradePlan(req, candidateData = {}, role = '') {
  const requestedId = Number(candidateData.id || candidateData.candidateId);
  if (Number.isFinite(requestedId) && requestedId > 0) {
    const exactCandidate = candidates.find((candidate) => candidate.id === requestedId);
    if (exactCandidate) return exactCandidate;
  }

  const email = String(candidateData.email || req.user?.email || '').trim().toLowerCase();
  if (!email) return null;

  return candidates
    .filter((candidate) => String(candidate.email || '').trim().toLowerCase() === email)
    .filter((candidate) => !role || !candidate.position || String(candidate.position).trim().toLowerCase() === String(role).trim().toLowerCase())
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
}

async function persistUpgradePlan(candidateRecord, role, payload, source, cacheKey) {
  if (!candidateRecord) return null;

  candidateRecord.upgradeSkillsPlan = {
    role: normalizeRoleKey(role),
    weakAreas: Array.isArray(payload?.weakAreas) ? payload.weakAreas : [],
    suggestions: Array.isArray(payload?.suggestions) ? payload.suggestions : [],
    source,
    cacheKey,
    generatedAt: new Date().toISOString()
  };

  await saveCandidates();
  return candidateRecord.upgradeSkillsPlan;
}

app.post('/api/upgrade-skills/suggestions', authenticateToken, async (req, res) => {
  try {
    if (!['candidate', 'recruiter', 'superadmin'].includes(req.user?.userType)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const role = normalizeRoleKey(req.body?.position || req.body?.targetRole, 'General');
    const candidateData = req.body?.candidateData || {};
    const forceRefresh = req.body?.forceRefresh === true || String(req.body?.forceRefresh || '').toLowerCase() === 'true';
    const cacheKey = buildUpgradeSuggestionsCacheKey(role, candidateData);
    const candidateRecord = findCandidateForUpgradePlan(req, candidateData, role);
    const storedPlan = candidateRecord?.upgradeSkillsPlan;

    if (!forceRefresh && storedPlan?.cacheKey === cacheKey && Array.isArray(storedPlan?.suggestions) && storedPlan.suggestions.length > 0) {
      return res.json({
        success: true,
        weakAreas: storedPlan.weakAreas || [],
        suggestions: storedPlan.suggestions,
        source: 'stored',
        generatedAt: storedPlan.generatedAt || null
      });
    }

    const fallback = buildUpgradeSuggestionsFallback(role, candidateData);
    const hasApiKey = process.env.OPENROUTER_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;

    if (!hasApiKey) {
      const stored = await persistUpgradePlan(candidateRecord, role, fallback, 'fallback', cacheKey);
      return res.json({ success: true, ...fallback, source: 'fallback', generatedAt: stored?.generatedAt || null });
    }

    const prompt = `Suggest learning resources for a ${role} candidate.
Scores: resume ${Number(candidateData.resumeScore) || 0}, quiz ${Number(candidateData.quizScore) || 0}, interview ${Number(candidateData.interviewScore) || 0}, live video ${Number(candidateData.videoInterviewScore) || 0}, uploaded video ${Number(candidateData.uploadVideoScore) || 0}.

Return ONLY valid JSON in this exact shape:
{
  "weakAreas": ["string"],
  "suggestions": [
    {
      "title": "string",
      "url": "https://example.com",
      "type": "website",
      "category": "string",
      "why": "string"
    }
  ]
}

Rules:
- Give 6 resources total.
- Mix websites, blogs, articles, documentation, or courses.
- Use real, publicly accessible links only.
- Tailor suggestions to the candidate's job role and weakest assessment areas.`;

    try {
      const raw = await callAI(prompt, 'You are a strict career resource recommendation engine. Return JSON only.', { task: 'career' });
      const parsed = parseJsonFromAI(raw, 'object');
      const suggestions = Array.isArray(parsed?.suggestions)
        ? parsed.suggestions.filter((item) => item && item.title && item.url).slice(0, 6).map((item) => ({
          title: String(item.title).trim(),
          url: String(item.url).trim(),
          type: String(item.type || 'website').trim(),
          category: String(item.category || role).trim(),
          why: String(item.why || '').trim()
        }))
        : [];

      if (suggestions.length > 0) {
        const payload = {
          weakAreas: Array.isArray(parsed?.weakAreas) ? parsed.weakAreas.map((item) => String(item || '').trim()).filter(Boolean) : fallback.weakAreas,
          suggestions
        };
        const stored = await persistUpgradePlan(candidateRecord, role, payload, 'ai', cacheKey);
        return res.json({
          success: true,
          weakAreas: payload.weakAreas,
          suggestions: payload.suggestions,
          source: 'ai',
          generatedAt: stored?.generatedAt || null
        });
      }
    } catch (aiError) {
      console.error('Upgrade skills AI suggestion error:', aiError.message);
    }

    const stored = await persistUpgradePlan(candidateRecord, role, fallback, 'fallback', cacheKey);
    return res.json({ success: true, ...fallback, source: 'fallback', generatedAt: stored?.generatedAt || null });
  } catch (error) {
    console.error('Upgrade skills endpoint error:', error);
    return res.status(500).json({ error: 'Failed to generate upgrade skill suggestions' });
  }
});

app.post('/api/career-advice', async (req, res) => {
  try {
    const { candidateData, position } = req.body;
    const {
      resumeScore = 0, quizScore = 0, interviewScore = 0,
      videoInterviewScore = 0, uploadVideoScore = 0
    } = candidateData || {};

    const totalScore = Math.round(
      (resumeScore + quizScore + interviewScore + videoInterviewScore + uploadVideoScore) / 5
    );

    const hasApiKey = process.env.OPENROUTER_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.OPENAI_API_KEY;

    if (hasApiKey) {
      // Use AI for dynamic generation
      const prompt = `Generate a personalized career roadmap for a ${position} candidate.
Their overall performance score across all assessments is ${totalScore}/100.
Their individual scores are: Resume: ${resumeScore}, Quiz: ${quizScore}, Interview: ${interviewScore}.

Provide an EXACT JSON response with the following format NO MARKDOWN and do not add any additional text or formatting:
{
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"],
  "improvements": [
    {
      "skill": "Specific skill name",
      "reason": "Why they need this",
      "url": "https://actual-course-or-video-url.com",
      "resource": "Name of the resource (e.g., Course, Video, Website)"
    }
  ],
  "suitableCompanies": [
    {
      "name": "Company Name",
      "type": "startup", // "startup", "mid-size", or "enterprise"
      "reason": "Why this company is a good fit and if they are known to be hiring",
      "url": "https://careers.company.com"
    }
  ],
  "nextSteps": "A personalized action plan paragraph. MUST INCLUDE specific advice on how to improve their GitHub, LinkedIn, and other professional profiles to stand out."
}

INSTRUCTIONS:
1. Provide exactly 3 specific structured "improvements" linking to real courses, videos, or websites.
2. Suggest exactly 3 real companies ("suitableCompanies") that match their skill level (${totalScore}/100) and indicate if they are actively hiring for ${position}.
3. Create a detailed "nextSteps" paragraph that evaluates their scores and tells them EXACTLY how to improve their GitHub, LinkedIn, or portfolio.`

      const systemPrompt = "You are a top-tier technical career coach. Return ONLY valid JSON.";
      
      try {
        const response = await callAI(prompt, systemPrompt, { task: 'career' });
        let cleaned = response.replace(/```json|```/g, '').trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) cleaned = match[0];
        const advice = JSON.parse(cleaned);
        return res.json({ success: true, advice });
      } catch (aiError) {
        console.error('AI career advice error, falling back locally', aiError);
      }
    }

    // Fallback local logic
    const advice = generateLocalCareerAdvice(
      position, totalScore, resumeScore, quizScore, interviewScore
    );
    // Append the profile improvement note for fallback
    advice.nextSteps += " Lastly, make sure to improve your GitHub by pinning real-world projects with detailed READMEs, and optimize your LinkedIn by highlighting exact technologies and quantifiable achievements.";

    return res.json({ success: true, advice });
  } catch (error) {
    console.error('Career advice error:', error);
    res.status(500).json({ error: 'Failed to generate career advice' });
  }
});

// ==================== RECRUITER PANEL ====================
const DUMMY_CANDIDATES = [
  { id: 101, name: 'Arjun Sharma', email: 'arjun.sharma@example.com', position: 'Software Engineer', resumeScore: 88, quizScore: 82, interviewScore: 79, videoInterviewScore: 91, uploadVideoScore: 85, totalScore: 85, createdAt: '2026-03-01T09:00:00Z', status: 'shortlisted' },
  { id: 102, name: 'Priya Nair', email: 'priya.nair@example.com', position: 'Data Scientist', resumeScore: 93, quizScore: 90, interviewScore: 88, videoInterviewScore: 86, uploadVideoScore: 90, totalScore: 89, createdAt: '2026-03-02T10:30:00Z', status: 'shortlisted' },
  { id: 103, name: 'Rahul Mehta', email: 'rahul.mehta@example.com', position: 'Frontend Developer', resumeScore: 72, quizScore: 68, interviewScore: 74, videoInterviewScore: 70, uploadVideoScore: 71, totalScore: 71, createdAt: '2026-03-03T11:00:00Z', status: 'review' },
  { id: 104, name: 'Sneha Kapoor', email: 'sneha.kapoor@example.com', position: 'Product Manager', resumeScore: 85, quizScore: 88, interviewScore: 92, videoInterviewScore: 89, uploadVideoScore: 87, totalScore: 88, createdAt: '2026-03-04T14:00:00Z', status: 'shortlisted' },
  { id: 105, name: 'Vikram Singh', email: 'vikram.singh@example.com', position: 'Backend Developer', resumeScore: 60, quizScore: 55, interviewScore: 62, videoInterviewScore: 58, uploadVideoScore: 60, totalScore: 59, createdAt: '2026-03-05T09:30:00Z', status: 'rejected' },
  { id: 106, name: 'Aisha Khan', email: 'aisha.khan@example.com', position: 'UI/UX Designer', resumeScore: 91, quizScore: 87, interviewScore: 85, videoInterviewScore: 93, uploadVideoScore: 89, totalScore: 89, createdAt: '2026-03-06T10:00:00Z', status: 'shortlisted' },
  { id: 107, name: 'Rohit Verma', email: 'rohit.verma@example.com', position: 'DevOps Engineer', resumeScore: 76, quizScore: 80, interviewScore: 73, videoInterviewScore: 77, uploadVideoScore: 75, totalScore: 76, createdAt: '2026-03-07T13:00:00Z', status: 'review' },
  { id: 108, name: 'Meera Patel', email: 'meera.patel@example.com', position: 'Full Stack Developer', resumeScore: 95, quizScore: 92, interviewScore: 90, videoInterviewScore: 94, uploadVideoScore: 93, totalScore: 93, createdAt: '2026-03-08T09:00:00Z', status: 'hired' },
];

app.get('/api/recruiter/candidates', authenticateToken, async (req, res) => {
  try {
    if (!['recruiter', 'superadmin'].includes(req.user?.userType)) {
      return res.status(403).json({ error: 'Recruiter or superadmin access required' });
    }

    // Recruiter: only return candidates superadmin has allowed. If allowedCandidateIds is null/undefined → see all.
    let sourceCandidates = candidates;
    if (req.user.userType === 'recruiter') {
      const recruiterUser = users.find(u => u.id === req.user.userId || u.email === req.user.email);
      if (recruiterUser && Array.isArray(recruiterUser.allowedCandidateIds)) {
        const allowed = new Set(recruiterUser.allowedCandidateIds);
        sourceCandidates = candidates.filter(c => allowed.has(c.id));
      }
    }

    const realCandidates = sourceCandidates.map(c => {
      const totalScore = Math.round(((c.resumeScore || 0) + (c.quizScore || 0) + (c.interviewScore || 0) + (c.videoInterviewScore || 0) + (c.uploadVideoScore || 0)) / 5);
      return {
        ...c,
        totalScore,
        status: c.status || 'review'
      };
    });

    res.json({ success: true, candidates: realCandidates });
  } catch (error) {
    console.error('Recruiter candidates error:', error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// ==================== AI-POWERED TEXT INTERVIEW ENGINE ====================

const INTERVIEW_STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'so', 'for', 'to', 'of', 'in', 'on', 'at', 'by', 'with',
  'from', 'into', 'about', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'i', 'me', 'my', 'we', 'our',
  'you', 'your', 'he', 'she', 'it', 'they', 'them', 'this', 'that', 'these', 'those', 'there', 'here', 'have', 'has', 'had',
  'do', 'does', 'did', 'not', 'no', 'yes', 'ok', 'okay', 'hmm', 'um', 'uh', 'like', 'just', 'really', 'very', 'can', 'could',
  'would', 'should', 'will', 'shall', 'also', 'too', 'only', 'more', 'most', 'some', 'any', 'all', 'each', 'other', 'such'
]);

function tokenizeInterviewText(text = '') {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function extractInterviewKeywords(text = '', limit = 12) {
  const tokens = tokenizeInterviewText(text);
  const counts = new Map();
  for (const token of tokens) {
    if (token.length < 3 || INTERVIEW_STOPWORDS.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}

function getLastAssistantQuestion(conversationHistory = []) {
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i];
    if (msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.trim()) {
      return msg.content;
    }
  }
  return '';
}

function evaluateInterviewAnswerQuality({ userMessage = '', position = '', expectedQuestion = '' }) {
  const message = (userMessage || '').trim();
  const words = tokenizeInterviewText(message);
  const wordCount = words.length;

  const trivialPhrases = new Set([
    'ok', 'okay', 'hmm', 'hm', 'yes', 'no', 'idk', 'i dont know', 'dont know', 'not sure', 'maybe'
  ]);

  const normalized = message.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const isGenericShortReply = trivialPhrases.has(normalized) || wordCount <= 3;

  const questionKeywords = new Set(extractInterviewKeywords(expectedQuestion, 14));
  const positionKeywords = new Set(extractInterviewKeywords(position, 6));
  const answerKeywords = new Set(extractInterviewKeywords(message, 30));

  const overlapWithQuestion = [...answerKeywords].filter(k => questionKeywords.has(k)).length;
  const overlapWithPosition = [...answerKeywords].filter(k => positionKeywords.has(k)).length;

  const relevanceSignal = Math.min(1, (overlapWithQuestion * 0.75 + overlapWithPosition * 0.5) / 4);
  const depthSignal = Math.min(1, wordCount / 90);
  const hasConcreteContext = /(for example|for instance|when i|i worked on|project|challenge|situation|result|impact|timeline|deadline|team)/i.test(message);
  const structureSignal = hasConcreteContext ? 1 : (/(because|therefore|so that|first|then|finally)/i.test(message) ? 0.7 : 0.4);

  let score = Math.round((relevanceSignal * 45) + (depthSignal * 30) + (structureSignal * 25));

  if (isGenericShortReply) score = Math.min(score, 15);
  if (wordCount < 8) score = Math.min(score, 35);
  if (relevanceSignal < 0.2) score = Math.min(score, 30);

  const isOffTopic = relevanceSignal < 0.2 && wordCount >= 4;
  const needsCoaching = isGenericShortReply || wordCount < 10 || isOffTopic;

  return {
    score: Math.max(0, Math.min(100, score)),
    wordCount,
    relevanceSignal,
    isOffTopic,
    isGenericShortReply,
    needsCoaching
  };
}

function getConsecutiveWeakAnswerStreak(conversationHistory = [], position = '', currentUserMessage = '') {
  const userEvaluations = [];

  for (let i = 0; i < conversationHistory.length; i++) {
    const msg = conversationHistory[i];
    if (msg.role !== 'user' || !msg.content) continue;

    let expectedQuestion = '';
    for (let j = i - 1; j >= 0; j--) {
      if (conversationHistory[j].role === 'assistant' && conversationHistory[j].content) {
        expectedQuestion = conversationHistory[j].content;
        break;
      }
    }

    const evalResult = evaluateInterviewAnswerQuality({
      userMessage: msg.content,
      position,
      expectedQuestion
    });

    userEvaluations.push(evalResult);
  }

  const lastHistoryMessage = conversationHistory.length > 0 ? conversationHistory[conversationHistory.length - 1] : null;
  const currentAlreadyInHistory =
    lastHistoryMessage &&
    lastHistoryMessage.role === 'user' &&
    String(lastHistoryMessage.content || '').trim() === String(currentUserMessage || '').trim();

  if (!currentAlreadyInHistory) {
    const currentExpectedQuestion = getLastAssistantQuestion(conversationHistory);
    userEvaluations.push(evaluateInterviewAnswerQuality({
      userMessage: currentUserMessage,
      position,
      expectedQuestion: currentExpectedQuestion
    }));
  }

  let streak = 0;
  for (let i = userEvaluations.length - 1; i >= 0; i--) {
    const ev = userEvaluations[i];
    const weak = ev.isGenericShortReply || ev.isOffTopic || ev.score < 35;
    if (!weak) break;
    streak += 1;
  }

  return streak;
}

function buildCoachingPrompt(position, expectedQuestion) {
  return `Let's stay focused on the interview topic for the ${position} role. Please answer this specific question with a concrete example (Situation, Action, Result): ${expectedQuestion}`;
}

// Start a new interview session — generates questions tailored to the position
app.post('/api/interview/start', async (req, res) => {
  try {
    const { candidateId, position, candidateName } = req.body;

    const sessionId = `interview_${candidateId}_${Date.now()}`;

    const systemPrompt = `You are Alex, a senior technical recruiter at a top tech company. 
You are conducting a professional job interview for a ${position} position.
Your style: professional yet warm, ask follow-up questions, probe depth of knowledge.
Always acknowledge the candidate's answer before asking the next question.`;

    const prompt = `Generate an opening greeting and the first interview question for ${candidateName || 'the candidate'} 
applying for the ${position} role.

Return ONLY valid JSON:
{
  "sessionId": "${sessionId}",
  "message": "Your warm opening greeting + first question",
  "questionNumber": 1,
  "totalQuestions": 5
}

The first question should assess their motivation and background for this role.`;

    try {
      const response = await callAI(prompt, systemPrompt, { task: 'interview' });
      const cleaned = response.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return res.json({ success: true, ...parsed });
    } catch {
      // Fallback opening question
      return res.json({
        success: true,
        sessionId,
        message: `Hello ${candidateName || 'there'}! Welcome, and thank you for taking the time to interview with us today. I'm Alex, and I'll be conducting your interview for the ${position} position. Let's start with a classic — could you walk me through your background and tell me what drew you to this ${position} role specifically?`,
        questionNumber: 1,
        totalQuestions: 5
      });
    }
  } catch (error) {
    console.error('Interview start error:', error);
    res.status(500).json({ error: 'Failed to start interview' });
  }
});

// Process an interview message and return AI response + score
app.post('/api/interview/message', async (req, res) => {
  try {
    const { position, candidateName, questionNumber, totalQuestions, userMessage, conversationHistory } = req.body;

    const isLastQuestion = questionNumber >= totalQuestions;
    const expectedQuestion = getLastAssistantQuestion(conversationHistory || []);
    const quality = evaluateInterviewAnswerQuality({
      userMessage,
      position,
      expectedQuestion
    });
    const weakAnswerStreak = getConsecutiveWeakAnswerStreak(conversationHistory || [], position, userMessage);

    if (weakAnswerStreak >= 3) {
      return res.json({
        success: true,
        message: `I am ending this assessment because multiple responses were too brief or off-topic for the ${position} interview. Your current interview score reflects the conversation quality so far.`,
        answerScore: Math.min(quality.score, 20),
        scoreFeedback: 'Assessment terminated after repeated off-topic or low-detail responses.',
        isComplete: true,
        questionNumber
      });
    }

    if (!isLastQuestion && quality.needsCoaching) {
      const coachingReason = quality.isGenericShortReply
        ? 'Your answer is too short to evaluate fairly.'
        : quality.isOffTopic
          ? 'Your answer is not aligned with the current interview question.'
          : 'Please add more role-relevant detail.';

      return res.json({
        success: true,
        message: `${coachingReason} ${buildCoachingPrompt(position, expectedQuestion || 'Please answer the current interview question.')}`,
        answerScore: Math.min(quality.score, 35),
        scoreFeedback: 'Need more relevant and specific details before moving to the next question.',
        isComplete: false,
        questionNumber
      });
    }

    const systemPrompt = `You are Alex, a senior technical recruiter interviewing ${candidateName || 'a candidate'} for a ${position} position.
  Use this structured scoring rubric consistently:
  - Clarity (0-100): structure, coherence, communication quality.
  - Depth (0-100): technical detail, specificity, evidence.
  - Relevance (0-100): alignment to the asked question and ${position} role.
  Final answerScore must be the rounded average of clarity, depth, relevance.

  Few-shot calibration examples:
  GOOD_CANDIDATE_EXAMPLE:
  Question: "Tell me about a production incident you handled."
  Answer: "In Q4 we saw API latency spike to 2.3s p95 after deploy. I rolled back, added query index, and introduced Redis caching. p95 dropped to 320ms and error rate fell 18%."
  Expected scores: clarity=88, depth=92, relevance=95, answerScore=92.

  BAD_CANDIDATE_EXAMPLE:
  Question: "How do you optimize backend performance?"
  Answer: "I am good at backend and use best practices."
  Expected scores: clarity=35, depth=18, relevance=28, answerScore=27.

  Always acknowledge the candidate naturally and ask the next relevant question when interview is not complete.`;

    const historyText = (conversationHistory || []).slice(-6).map(m =>
      `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content}`
    ).join('\n');

    const prompt = `Conversation so far:
${historyText}

Candidate just said: "${userMessage}"
This was question ${questionNumber} of ${totalQuestions}.

${isLastQuestion
  ? 'This is the final question. Evaluate their answer, thank them warmly, wrap up the interview, and tell them next steps.'
  : `Acknowledge their answer specifically (mention something they said), score it mentally, then independently ask the next question (${questionNumber + 1}) based on the natural flow of conversation for a ${position} interview.`
}

Return ONLY this strict JSON object:
{
  "message": "Your response as Alex the interviewer",
  "reasoningSummary": "One concise sentence describing why the score was assigned",
  "criteriaScores": {
    "clarity": <0-100 integer>,
    "depth": <0-100 integer>,
    "relevance": <0-100 integer>
  },
  "answerScore": <number 0-100 rating how well they answered this specific question>,
  "scoreFeedback": "<one sentence explaining the score>",
  "isComplete": ${isLastQuestion},
  "questionNumber": ${isLastQuestion ? questionNumber : questionNumber + 1}
}
Rules:
- answerScore must equal rounded average of criteriaScores.clarity, criteriaScores.depth, criteriaScores.relevance.
- Output must be valid JSON only, no markdown.`;

    try {
      const response = await callAI(prompt, systemPrompt, { task: 'interview' });
      const parsed = parseJsonFromAI(response, 'object');
      const criteria = parsed.criteriaScores || {};
      const clarity = clampScore(criteria.clarity, 0, 100, 0);
      const depth = clampScore(criteria.depth, 0, 100, 0);
      const relevance = clampScore(criteria.relevance, 0, 100, 0);
      const averagedScore = Math.round((clarity + depth + relevance) / 3);
      const safeScore = clampScore(parsed.answerScore, 0, 100, averagedScore);
      let adjustedScore = safeScore;

      if (quality.isGenericShortReply) adjustedScore = Math.min(adjustedScore, 20);
      if (quality.isOffTopic) adjustedScore = Math.min(adjustedScore, 30);
      if (quality.wordCount < 8) adjustedScore = Math.min(adjustedScore, 35);
      adjustedScore = Math.round((adjustedScore * 0.7) + (quality.score * 0.3));

      return res.json({
        success: true,
        ...parsed,
        criteriaScores: { clarity, depth, relevance },
        reasoningSummary: String(parsed.reasoningSummary || '').trim().slice(0, 280),
        answerScore: adjustedScore,
        scoreFeedback: parsed.scoreFeedback || (adjustedScore >= 70
          ? 'Relevant and fairly detailed response.'
          : 'Response needs stronger relevance and specific examples.')
      });
    } catch {
      // Smart fallback
      const fallbackScore = quality.score;
      const fallbackMessages = [
        `Thank you for sharing that. It's great to see your ${position}-related experience. Now, tell me about a specific technical challenge you've overcome — what was the situation and how did you approach solving it?`,
        `Interesting perspective! Handling challenges well is key in this role. How do you typically manage stress or tight deadlines? Can you give me a real example?`,
        `That's a solid answer. Continuous learning is crucial in tech. What's the last new technology or tool you learned, and how did you apply it?`,
        `Great to hear your growth mindset. Last question — where do you see yourself in 3 years, and why does this ${position} role fit your career path?`,
        `Thank you so much for your time today! You've given thoughtful answers throughout our conversation. Our team will review everything and get back to you within 5-7 business days. Best of luck!`
      ];
      return res.json({
        success: true,
        message: fallbackMessages[questionNumber - 1] || fallbackMessages[fallbackMessages.length - 1],
        answerScore: fallbackScore,
        scoreFeedback: fallbackScore >= 70 ? 'Relevant and fairly detailed response.' : 'Response needs stronger relevance and specific examples.',
        isComplete: isLastQuestion,
        questionNumber: isLastQuestion ? questionNumber : questionNumber + 1
      });
    }
  } catch (error) {
    console.error('Interview message error:', error);
    res.status(500).json({ error: 'Failed to process interview message' });
  }
});

// Save final interview score for a candidate
app.post('/api/candidates/:id/interview-score', async (req, res) => {
  try {
    const candidateId = parseInt(req.params.id);
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const { score } = req.body;
    candidate.interviewScore = Math.round(score);
    candidate.interviewCompletedAt = new Date().toISOString();
    await saveCandidates();

    res.json({ success: true, interviewScore: candidate.interviewScore });
  } catch (error) {
    console.error('Save interview score error:', error);
    res.status(500).json({ error: 'Failed to save interview score' });
  }
});

function chatbotFallbackReply(message = '', role = 'guest') {
  const text = String(message || '').toLowerCase();

  if (text.includes('resume')) {
    return 'For resume success: upload PDF/DOCX/TXT, keep project outcomes measurable, and align keywords with your target role before re-analyzing.';
  }
  if (text.includes('quiz') || text.includes('assessment')) {
    return 'The technical quiz uses weighted scoring. Focus on clarity and correctness first, then revisit flagged questions before submitting.';
  }
  if (text.includes('interview') || text.includes('video')) {
    return 'For interview stages, keep answers concise using Situation → Action → Result, and maintain clear audio/video for stronger evaluation signals.';
  }
  if (role === 'recruiter') {
    return 'As a recruiter, use dashboard filters for status and score bands, then open expanded candidate rows to compare stage-wise strengths quickly.';
  }
  if (role === 'candidate') {
    return 'As a candidate, complete stages in order: profile, resume, video, quiz, interview, and results to maximize scoring accuracy.';
  }

  return 'I can help with profile setup, resume scoring, quizzes, interviews, pricing, and recruiter dashboard workflows. Tell me what you want to do next.';
}

const CAREER_COACH_ROLE_SKILLS = {
  'Software Engineer': ['Data Structures', 'Algorithms', 'JavaScript', 'System Design', 'Git'],
  'Frontend Developer': ['HTML', 'CSS', 'JavaScript', 'React', 'Accessibility'],
  'Backend Developer': ['Node.js', 'APIs', 'Databases', 'Authentication', 'System Design'],
  'Full Stack Developer': ['React', 'Node.js', 'SQL', 'System Design', 'Testing'],
  'Data Scientist': ['Python', 'Statistics', 'Machine Learning', 'SQL', 'Data Visualization'],
  'Machine Learning Engineer': ['Python', 'Machine Learning', 'Deep Learning', 'MLOps', 'Data Engineering'],
  'DevOps Engineer': ['Linux', 'CI/CD', 'Docker', 'Kubernetes', 'Cloud'],
  'Product Manager': ['Product Strategy', 'User Research', 'Analytics', 'Roadmapping', 'Communication'],
  'UI/UX Designer': ['User Research', 'Wireframing', 'Figma', 'Design Systems', 'Prototyping'],
  'Android Developer': ['Kotlin', 'Android SDK', 'Architecture Patterns', 'REST APIs', 'Testing'],
  'iOS Developer': ['Swift', 'iOS SDK', 'Architecture Patterns', 'REST APIs', 'Testing'],
  'QA Engineer': ['Manual Testing', 'Automation Testing', 'Selenium', 'API Testing', 'Test Strategy']
};

const CAREER_COACH_EXPERIENCE_LEVELS = ['fresher', 'junior', 'mid', 'senior'];

const CAREER_COACH_ROLE_RESOURCES = {
  'Software Engineer': [
    { title: 'NeetCode Roadmap', url: 'https://neetcode.io/roadmap', why: 'Build interview-ready data structures and algorithms depth.' },
    { title: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer', why: 'Grow architecture fundamentals for scalable systems.' },
    { title: 'Clean Code JavaScript', url: 'https://github.com/ryanmcdermott/clean-code-javascript', why: 'Improve code quality and maintainability habits.' }
  ],
  'Frontend Developer': [
    { title: 'React Learn', url: 'https://react.dev/learn', why: 'Master component architecture and modern React workflows.' },
    { title: 'web.dev CSS', url: 'https://web.dev/learn/css/', why: 'Strengthen responsive layout and visual implementation.' },
    { title: 'Frontend Mentor', url: 'https://www.frontendmentor.io/', why: 'Build portfolio-quality UI projects with real constraints.' }
  ],
  'Backend Developer': [
    { title: 'Node.js Learn', url: 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs', why: 'Build strong backend runtime and API fundamentals.' },
    { title: 'PostgreSQL Tutorial', url: 'https://www.postgresqltutorial.com/', why: 'Design robust relational schemas and SQL workflows.' },
    { title: 'Auth0 Guides', url: 'https://auth0.com/docs', why: 'Improve authentication and authorization implementation quality.' }
  ],
  'Full Stack Developer': [
    { title: 'Full Stack Open', url: 'https://fullstackopen.com/en/', why: 'Build complete frontend-backend product experience.' },
    { title: 'Docker Getting Started', url: 'https://docs.docker.com/get-started/', why: 'Ship and run full-stack apps in reliable environments.' },
    { title: 'GitHub Actions Docs', url: 'https://docs.github.com/en/actions', why: 'Automate testing and deployment pipelines end to end.' }
  ],
  'Data Scientist': [
    { title: 'Kaggle Learn', url: 'https://www.kaggle.com/learn', why: 'Build practical model-building and analysis workflow skills.' },
    { title: 'Scikit-learn Tutorials', url: 'https://scikit-learn.org/stable/tutorial/index.html', why: 'Strengthen model training and evaluation rigor.' },
    { title: 'Mode SQL Tutorial', url: 'https://mode.com/sql-tutorial/', why: 'Improve data extraction and analytics query fluency.' }
  ],
  'Machine Learning Engineer': [
    { title: 'PyTorch Tutorials', url: 'https://pytorch.org/tutorials/', why: 'Advance model development and experimentation capability.' },
    { title: 'Hugging Face NLP Course', url: 'https://huggingface.co/learn/nlp-course/chapter1/1', why: 'Build transformer and LLM engineering competence.' },
    { title: 'MLflow Docs', url: 'https://mlflow.org/docs/latest/index.html', why: 'Adopt model tracking and MLOps best practices.' }
  ],
  'DevOps Engineer': [
    { title: 'Kubernetes Basics', url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/', why: 'Strengthen cluster operations and orchestration skills.' },
    { title: 'Terraform Tutorials', url: 'https://developer.hashicorp.com/terraform/tutorials', why: 'Improve infrastructure-as-code reliability and repeatability.' },
    { title: 'Grafana Tutorials', url: 'https://grafana.com/tutorials/', why: 'Build practical observability and monitoring workflows.' }
  ],
  'Product Manager': [
    { title: 'Atlassian Agile Coach', url: 'https://www.atlassian.com/agile', why: 'Improve execution velocity with agile delivery frameworks.' },
    { title: 'NNGroup UX Research', url: 'https://www.nngroup.com/articles/', why: 'Sharpen user research and product discovery quality.' },
    { title: 'ProductPlan Guides', url: 'https://www.productplan.com/learn/', why: 'Build stronger roadmap and prioritization strategy.' }
  ],
  'UI/UX Designer': [
    { title: 'Figma Learn', url: 'https://help.figma.com/hc/en-us/categories/360002051613-Getting-started', why: 'Improve prototyping and design system execution.' },
    { title: 'A11Y Project', url: 'https://www.a11yproject.com/', why: 'Design more inclusive and accessible user experiences.' },
    { title: 'Usability.gov', url: 'https://www.usability.gov/how-to-and-tools/methods/usability-testing.html', why: 'Run better usability testing and iterate with evidence.' }
  ],
  'Android Developer': [
    { title: 'Android Developers Kotlin', url: 'https://developer.android.com/kotlin', why: 'Solidify modern Android development foundations.' },
    { title: 'Jetpack Compose Pathway', url: 'https://developer.android.com/courses/pathways/compose', why: 'Build modern declarative UI implementation skills.' },
    { title: 'Android Architecture Guide', url: 'https://developer.android.com/topic/architecture', why: 'Design maintainable app architecture with best practices.' }
  ],
  'iOS Developer': [
    { title: 'Swift Book', url: 'https://docs.swift.org/swift-book/', why: 'Strengthen modern Swift language mastery.' },
    { title: 'Apple SwiftUI Tutorials', url: 'https://developer.apple.com/tutorials/swiftui/', why: 'Build production-ready declarative iOS interfaces.' },
    { title: 'TestFlight Guide', url: 'https://developer.apple.com/testflight/', why: 'Improve release quality through structured beta testing.' }
  ],
  'QA Engineer': [
    { title: 'Selenium Documentation', url: 'https://www.selenium.dev/documentation/', why: 'Improve browser automation depth and reliability.' },
    { title: 'Postman Learning Center', url: 'https://learning.postman.com/docs/getting-started/introduction/', why: 'Build stronger API validation and workflow testing.' },
    { title: 'JMeter Getting Started', url: 'https://jmeter.apache.org/usermanual/get-started.html', why: 'Develop practical load and performance testing skills.' }
  ]
};

const CAREER_COACH_LEVEL_RESOURCES = {
  fresher: { title: 'roadmap.sh', url: 'https://roadmap.sh/', why: 'Use a structured beginner roadmap and track progress weekly.' },
  junior: { title: 'LinkedIn Learning', url: 'https://www.linkedin.com/learning/', why: 'Close practical skill gaps with guided, job-focused modules.' },
  mid: { title: 'System Design Interview Hub', url: 'https://www.educative.io/path/system-design', why: 'Move from implementation depth to architecture decision-making.' },
  senior: { title: 'Staff Engineer Path', url: 'https://staffeng.com/guides/', why: 'Grow technical leadership, influence, and strategic execution.' }
};

function normalizeCareerCoachExperienceLevel(value) {
  const level = String(value || '').trim().toLowerCase();
  return CAREER_COACH_EXPERIENCE_LEVELS.includes(level) ? level : 'fresher';
}

function getCareerCoachResources(role = '', experienceLevel = 'fresher') {
  const roleResources = CAREER_COACH_ROLE_RESOURCES[role] || CAREER_COACH_ROLE_RESOURCES['Software Engineer'];
  const level = normalizeCareerCoachExperienceLevel(experienceLevel);
  const levelResource = CAREER_COACH_LEVEL_RESOURCES[level] || CAREER_COACH_LEVEL_RESOURCES.fresher;

  const selected = [
    ...(roleResources.slice(0, 2)),
    {
      title: `${levelResource.title} (${level})`,
      url: levelResource.url,
      why: levelResource.why
    }
  ];

  return selected.slice(0, 3);
}

function parseCareerCoachSkills(rawSkills) {
  if (Array.isArray(rawSkills)) {
    return rawSkills.map(s => String(s || '').trim()).filter(Boolean).slice(0, 30);
  }

  return String(rawSkills || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function assessCompanyEligibility(role = '', targetCompany = '', proficiency = 0, missingSkills = []) {
  const company = String(targetCompany || '').trim();
  if (!company) return null;

  const score = clampScore(proficiency, 0, 100, 0);
  const requiredSkills = Array.isArray(missingSkills)
    ? missingSkills.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 6)
    : [];

  const eligible = score >= 70 && requiredSkills.length <= 2;
  const reason = eligible
    ? `Profile is currently aligned for ${company} in ${role || 'this role'} based on readiness score and skill coverage.`
    : `Profile needs stronger readiness for ${company}. Improve missing role-critical skills before applying.`;

  return {
    company,
    eligible,
    reason,
    requiredSkills: eligible ? [] : requiredSkills
  };
}

function buildCareerCoachFallback(role = '', skills = [], experienceLevel = 'fresher', targetCompany = '') {
  const expectedSkills = CAREER_COACH_ROLE_SKILLS[role] || ['Communication', 'Problem Solving', 'Domain Knowledge'];
  const normalized = skills.map(s => s.toLowerCase());
  const level = normalizeCareerCoachExperienceLevel(experienceLevel);

  const matchingSkills = expectedSkills.filter((expected) =>
    normalized.some((skill) => skill.includes(expected.toLowerCase()))
  );
  const missingSkills = expectedSkills.filter((expected) => !matchingSkills.includes(expected));
  const proficiency = Math.round((matchingSkills.length / Math.max(expectedSkills.length, 1)) * 100);

  const roadmap = [
    `Weeks 1-2: Build fundamentals for ${role} with daily practice and topic revision.`,
    `Weeks 3-4: Build one project focused on ${missingSkills[0] || expectedSkills[0]} and publish code with README.`,
    'Weeks 5-6: Practice interviews with STAR structure and improve problem explanation clarity.',
    'Weeks 7-8: Apply to target roles, collect feedback, and iterate your portfolio and resume.'
  ];

  const recommendations = missingSkills.length
    ? missingSkills.map((skill) => `Improve ${skill} with hands-on mini projects and guided courses.`)
    : ['Strong baseline profile. Focus on advanced projects, interview storytelling, and consistency.'];

  const resources = getCareerCoachResources(role, level);
  const companyEligibility = assessCompanyEligibility(role, targetCompany, proficiency, missingSkills);

  return {
    role,
    targetCompany: String(targetCompany || '').trim(),
    experienceLevel: level,
    skills,
    proficiency: clampScore(proficiency, 0, 100, 0),
    matchingSkills,
    missingSkills,
    companyEligibility,
    recommendations,
    roadmap,
    resources
  };
}

function normalizeCareerCoachGuidance(parsed = {}, fallback = {}) {
  const guidance = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  const safeRole = String(guidance.role || fallback.role || '').trim();
  const safeSkills = Array.isArray(guidance.skills)
    ? guidance.skills.map(s => String(s || '').trim()).filter(Boolean).slice(0, 30)
    : (fallback.skills || []);

  const matchingSkills = Array.isArray(guidance.matchingSkills)
    ? guidance.matchingSkills.map(s => String(s || '').trim()).filter(Boolean).slice(0, 15)
    : (fallback.matchingSkills || []);

  const missingSkills = Array.isArray(guidance.missingSkills)
    ? guidance.missingSkills.map(s => String(s || '').trim()).filter(Boolean).slice(0, 15)
    : (fallback.missingSkills || []);

  const recommendations = Array.isArray(guidance.recommendations)
    ? guidance.recommendations.map(s => String(s || '').trim()).filter(Boolean).slice(0, 10)
    : (fallback.recommendations || []);

  const roadmap = Array.isArray(guidance.roadmap)
    ? guidance.roadmap.map(s => String(s || '').trim()).filter(Boolean).slice(0, 8)
    : (fallback.roadmap || []);

  const resources = Array.isArray(guidance.resources)
    ? guidance.resources
      .filter(r => r && typeof r === 'object')
      .map((r) => ({
        title: String(r.title || '').trim(),
        url: String(r.url || '').trim(),
        why: String(r.why || '').trim()
      }))
      .filter((r) => r.title && r.url)
      .slice(0, 5)
    : (fallback.resources || []);

  return {
    role: safeRole,
    targetCompany: String(guidance.targetCompany || fallback.targetCompany || '').trim(),
    experienceLevel: normalizeCareerCoachExperienceLevel(guidance.experienceLevel || fallback.experienceLevel),
    skills: safeSkills,
    proficiency: clampScore(guidance.proficiency, 0, 100, fallback.proficiency || 0),
    matchingSkills,
    missingSkills,
    companyEligibility: (() => {
      const raw = guidance.companyEligibility;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const company = String(raw.company || guidance.targetCompany || fallback.targetCompany || '').trim();
        if (!company) return null;
        const eligible = Boolean(raw.eligible);
        const requiredSkills = Array.isArray(raw.requiredSkills)
          ? raw.requiredSkills.map(s => String(s || '').trim()).filter(Boolean).slice(0, 6)
          : [];
        return {
          company,
          eligible,
          reason: String(raw.reason || '').trim() || (eligible
            ? `Profile is currently aligned for ${company}.`
            : `Profile needs stronger readiness for ${company}.`),
          requiredSkills: eligible ? [] : requiredSkills
        };
      }
      return assessCompanyEligibility(
        safeRole,
        guidance.targetCompany || fallback.targetCompany,
        clampScore(guidance.proficiency, 0, 100, fallback.proficiency || 0),
        missingSkills
      );
    })(),
    recommendations,
    roadmap,
    resources
  };
}

function careerCoachChatFallback(message = '', targetRole = '', targetCompany = '', skills = [], guidance = null, experienceLevel = 'fresher') {
  const baseRole = targetRole || 'your selected role';
  const weakArea = guidance?.missingSkills?.[0] || 'core fundamentals';
  const level = normalizeCareerCoachExperienceLevel(experienceLevel);
  const skillHint = skills.length ? `Based on your current skills (${skills.slice(0, 5).join(', ')}), ` : '';

  if (/resume|cv/i.test(message)) {
    return `${skillHint}tailor your resume to ${baseRole} by adding measurable project outcomes and keywords for ${weakArea}.`;
  }
  if (/roadmap|plan|next/i.test(message)) {
    return `Start with ${weakArea}, build one project in 2 weeks, and practice interview explanations every day. Keep improving until your portfolio proves ${baseRole} readiness.`;
  }
  if (/course|learn|resource/i.test(message)) {
    const links = getCareerCoachResources(targetRole, level).map(r => r.url).join(' | ');
    return `Prioritize practical learning for ${weakArea}. Recommended links: ${links}. Complete one mini project and publish your learnings weekly.`;
  }

  if (/eligible|eligibility|company|apply/i.test(message) && targetCompany) {
    const status = guidance?.companyEligibility?.eligible
      ? `You look eligible for ${targetCompany}.`
      : `You are not eligible for ${targetCompany} yet.`;
    const required = Array.isArray(guidance?.companyEligibility?.requiredSkills) && guidance.companyEligibility.requiredSkills.length
      ? ` Focus on: ${guidance.companyEligibility.requiredSkills.join(', ')}.`
      : '';
    return `${status}${required}`;
  }

  return `${skillHint}focus first on ${weakArea}, then build a role-focused project and document outcomes clearly. I can also help you break this into a weekly routine.`;
}

app.post('/api/career-coach', async (req, res) => {
  try {
    const mode = String(req.body?.mode || 'analyze').trim().toLowerCase();
    const targetRole = String(req.body?.targetRole || '').trim();
    const targetCompany = String(req.body?.targetCompany || '').trim();
    const experienceLevel = normalizeCareerCoachExperienceLevel(req.body?.experienceLevel);
    const skills = parseCareerCoachSkills(req.body?.skills);
    const message = String(req.body?.message || '').trim();
    const guidanceContext = req.body?.guidance;

    if (mode === 'chat') {
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const hasApiKey = process.env.OPENROUTER_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
      if (hasApiKey) {
        const systemPrompt = `You are TalentAI Career Coach.
Give concise, practical career guidance for candidates.
Keep responses actionable and under 120 words.`;

        const prompt = `Candidate target role: ${targetRole || 'Not set'}
      Candidate target company: ${targetCompany || 'Not set'}
    Candidate experience level: ${experienceLevel}
Candidate skills: ${skills.join(', ') || 'Not provided'}
Current guidance context: ${JSON.stringify(guidanceContext || {})}
Candidate message: ${message}

Reply with direct next-step guidance.`;

        try {
          const reply = await callAI(prompt, systemPrompt, { task: 'career' });
          return res.json({
            success: true,
            reply: String(reply || '').trim().slice(0, 1400) || careerCoachChatFallback(message, targetRole, targetCompany, skills, guidanceContext, experienceLevel)
          });
        } catch (aiError) {
          console.error('Career coach chat AI error:', aiError.message);
        }
      }

      return res.json({ success: true, reply: careerCoachChatFallback(message, targetRole, targetCompany, skills, guidanceContext, experienceLevel) });
    }

    if (!targetRole || !targetCompany || skills.length === 0) {
      return res.status(400).json({ error: 'targetRole, targetCompany, and skills are required for analysis' });
    }

    const fallbackGuidance = buildCareerCoachFallback(targetRole, skills, experienceLevel, targetCompany);
    const hasApiKey = process.env.OPENROUTER_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;

    if (hasApiKey) {
      const systemPrompt = `You are TalentAI Career Coach.
Return only valid JSON with no markdown.`;

      const prompt = `Create personalized career guidance for a candidate.
Target role: ${targetRole}
Target company: ${targetCompany}
Candidate experience level: ${experienceLevel}
Candidate skills: ${skills.join(', ')}

Return EXACT JSON:
{
  "role": "${targetRole}",
  "targetCompany": "${targetCompany}",
  "experienceLevel": "${experienceLevel}",
  "skills": ["skill"],
  "proficiency": 0,
  "matchingSkills": ["skill"],
  "missingSkills": ["skill"],
  "companyEligibility": {
    "company": "${targetCompany}",
    "eligible": false,
    "reason": "string",
    "requiredSkills": ["skill"]
  },
  "recommendations": ["string"],
  "roadmap": ["string", "string", "string", "string"],
  "resources": [
    {
      "title": "resource title",
      "url": "https://valid-link.example",
      "why": "short reason"
    }
  ]
}

Rules:
- proficiency is integer 0-100.
- companyEligibility.eligible must be true only when profile is realistically ready for ${targetCompany}.
- if not eligible, companyEligibility.requiredSkills must list the key missing skills.
- recommendations must focus on improving missing skills.
- roadmap should be practical, progressive, and weekly-oriented.
- include exactly 3 role-specific resources matching the experience level.`;

      try {
        const response = await callAI(prompt, systemPrompt, { task: 'career' });
        const parsed = parseJsonFromAI(response, 'object');
        const guidance = normalizeCareerCoachGuidance(parsed, fallbackGuidance);
        return res.json({ success: true, guidance });
      } catch (aiError) {
        console.error('Career coach guidance AI error:', aiError.message);
      }
    }

    return res.json({ success: true, guidance: fallbackGuidance });
  } catch (error) {
    console.error('Career coach endpoint error:', error);
    return res.status(500).json({ error: 'Failed to process career coach request' });
  }
});

app.post('/api/chatbot', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    const role = String(req.body?.role || 'guest').trim().toLowerCase();
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const formattedHistory = history
      .filter(item => item && typeof item === 'object')
      .map(item => `${item.role === 'user' ? 'User' : 'Assistant'}: ${String(item.content || '').slice(0, 400)}`)
      .join('\n');

    const systemPrompt = `You are TalentAI Support Bot.
Audience: candidates, recruiters, and admins.
Tone: professional, concise, and practical.
Rules:
- Provide actionable guidance specific to TalentAI workflows.
- For account or server issues, suggest clear troubleshooting steps.
- Never invent private data.
- Keep responses within 4 short paragraphs or bullet-style text.`;

    const prompt = `Role: ${role}
Conversation history:
${formattedHistory || 'No prior messages.'}

Latest user question:
${message}

Respond with direct, helpful guidance for TalentAI website usage.`;

    try {
      const reply = await callAI(prompt, systemPrompt, { task: 'career' });
      return res.json({
        success: true,
        reply: String(reply || '').trim().slice(0, 1400) || chatbotFallbackReply(message, role)
      });
    } catch (aiError) {
      console.error('Chatbot AI error:', aiError.message);
      return res.json({ success: true, reply: chatbotFallbackReply(message, role) });
    }
  } catch (error) {
    console.error('Chatbot endpoint error:', error);
    return res.status(500).json({ error: 'Failed to process chatbot request' });
  }
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  const aiProvider = process.env.OPENROUTER_API_KEY
    ? `openrouter (${process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct:free'})`
    : process.env.AI_PROVIDER || 'gemini';
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aiProvider,
    openRouter: !!process.env.OPENROUTER_API_KEY,
    cloudStorage: useGCS
  });
});

app.get('/api/ai-router/stats', (req, res) => {
  try {
    res.json({
      success: true,
      modelStats: getTalentRouterModelStats(),
      costReport: getTalentRouterCostReport(),
      abTests: getTalentRouterABTestResults()
    });
  } catch (error) {
    console.error('AI router stats error:', error.message);
    res.status(500).json({ error: 'Failed to fetch AI router stats' });
  }
});

// ==================== API v1 ROUTES ====================
// Versioned routes: /api/v1/ai/*
app.use('/api/v1/ai', v1AiRouter);

// ==================== AUTH v2 (refresh tokens) ====================
// POST /api/auth/refresh — issue new access token from refresh token
app.post('/api/auth/refresh', handleRefreshToken);
// POST /api/auth/logout  — blacklist access token + revoke refresh token
app.post('/api/auth/logout', handleLogout);

// ==================== 404 & GLOBAL ERROR HANDLER ====================
app.use(notFoundHandler);
app.use(globalErrorHandler);


// ==================== START SERVER ====================
async function startServer() {
  // Load data from cloud and seed superadmin before serving traffic
  await ensureDataInitialized();

  // Don't listen to port if running on Vercel (serverless)
  if (process.env.VERCEL) {
    return;
  }

  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║       TalentAI Backend Server Running      ║
║                                            ║
║  Port: ${PORT}                              ║
║  AI Provider: ${process.env.AI_PROVIDER || 'gemini'}                    ║
║  Cloud Storage: ${useGCS ? '✅ Enabled' : '❌ Disabled'}               ║
╚════════════════════════════════════════════╝
    `);
  });
}

if (!process.env.VERCEL) {
  startServer().catch(console.error);
} else {
  // Warm initialization for serverless; request middleware also guarantees readiness.
  ensureDataInitialized().catch(console.error);
}

module.exports = app;
