# TalentAI Recruitment Platform - Server Deployment Guide

## Overview
This document guides you through deploying the production-ready server.js on Railway with your React frontend on Vercel.

## Architecture
- **Backend**: Express + Node.js on Railway (manages MongoDB, API routes, file uploads)
- **Frontend**: React (Create React App) on Vercel (https://anupmazumdar-ai-recruitment-agent.vercel.app)
- **Database**: MongoDB Atlas (cloud-hosted)
- **File Storage**: Local /uploads directory on Railway (ephemeral - files cleared on restart)

---

## Phase 1: MongoDB Atlas Setup (if not already done)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster and database
3. Create a database user with read/write permissions
4. Copy the connection string: `mongodb+srv://user:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority`

---

## Phase 2: Railway Deployment

### Step 1: Prepare Repository
```bash
# Ensure these files exist in root:
- server.js                    # Express entry point
- package.json                 # Updated with "start": "node server.js"
- /api/models/                 # Mongoose schemas
- /api/routes/v1/              # API endpoints
- /api/middleware/             # Error handlers, loggers
- /frontend/build/             # React build (run: npm run build --prefix frontend)
```

### Step 2: Create Railway Project
```bash
# Option A: Use Railway CLI
npm install -g @railway/cli
railway login
railway init

# Option B: Manual via Railway Dashboard
# 1. Go to https://railway.app
# 2. Click "New Project"
# 3. Select "Deploy from GitHub"
# 4. Connect your GitHub repo
```

### Step 3: Configure Environment Variables

In Railway Dashboard → Project Settings → Variables, add:

```
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/talentai?retryWrites=true&w=majority
FRONTEND_URL=https://anupmazumdar-ai-recruitment-agent.vercel.app
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
```

### Step 4: Set Node.js Version

Railway → Project → Settings → Ensure Node.js version is 18+ (recommended: 20+)

### Step 5: Deploy

```bash
# Via CLI
railway up

# Via Dashboard
# Push to GitHub, Railway auto-deploys on main branch changes
# OR manually trigger: Railway Dashboard → Deployments → New Deployment
```

### Step 6: Verify Deployment

After deployment completes:

```bash
# Test health endpoint
curl https://<your-railway-domain>/api/health
# Expected response: {"status":"UP","database":"CONNECTED",...}

# Check logs
railway logs
```

---

## Phase 3: Frontend CORS Configuration

The server is already configured for CORS:

```javascript
// server.js CORS options include:
- https://anupmazumdar-ai-recruitment-agent.vercel.app
- http://localhost:3000  (local development)
- http://localhost:3001  (local API)
```

Update your React frontend API calls:

```javascript
// src/services/api.js
const API_BASE = process.env.REACT_APP_API_URL || 
                 'https://<your-railway-domain>';

export const createCandidate = (data) =>
  fetch(`${API_BASE}/api/candidates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  }).then(r => r.json());
```

---

## API Reference

### Candidates
```
POST   /api/candidates              Create candidate
GET    /api/candidates              List candidates (filters: status, jobRole, pagination)
GET    /api/candidates/:id          Get one candidate + evaluations
PATCH  /api/candidates/:id          Update status/details
DELETE /api/candidates/:id          Delete candidate + resume + evaluations
```

### Resume Upload
```
POST   /api/resume/upload/:id       Upload resume (PDF/DOC/DOCX, max 5MB)
```

### Evaluations
```
POST   /api/evaluations             Save AI evaluation result
GET    /api/evaluations/:candidateId Get all evaluations for candidate
```

### System
```
GET    /api/health                  Health check (DB connection status)
```

---

## Database Schema

### Candidate
```javascript
{
  _id: ObjectId,
  name: String (required),
  email: String (required, unique),
  phone: String,
  jobRole: String (required),
  resumeUrl: String,          // /api/uploads/videos/filename
  resumeText: String,         // Extracted text from resume
  status: String,             // 'applied', 'screening', 'interview', 'selected', 'rejected'
  evaluations: [ObjectId],    // References to Evaluation docs
  metadata: {
    source: String,
    appliedAt: Date,
    notes: String
  },
  timestamps: { createdAt, updatedAt }
}
```

### Evaluation
```javascript
{
  _id: ObjectId,
  candidateId: ObjectId (ref Candidate),
  taskMode: String,           // 'RESUME_PARSING', 'CANDIDATE_SCORING', etc.
  modelUsed: String,          // 'gpt-4o', 'claude-3-sonnet', etc.
  confidenceScore: Number,    // 0-1
  latencyMs: Number,
  estimatedCost: Number,
  result: Mixed,              // AI model output (can be any structure)
  rawText: String,
  status: String,             // 'pending', 'completed', 'failed'
  error: String,
  timestamps: { createdAt }
}
```

---

## File Upload Storage

**Location**: `/api/uploads/videos/`

**Limitations on Railway**:
- Files are stored locally on Railway's ephemeral filesystem
- **Files are deleted when Railway restarts** (auto-deploy, scale changes, etc.)
- For production, migrate to:
  - **Azure Blob Storage** (recommended for railway.app integration)
  - **AWS S3**
  - **Google Cloud Storage** (your GCS integration already exists in talentai.js)

**Recommended for Production**:
```javascript
// Update api/routes/v1/upload.js to use GCS instead of local storage
const { Storage } = require('@google-cloud/storage');
const gcs = new Storage();
// Store resumeUrl as gs://bucket/path/filename
```

---

## Troubleshooting

### Container Exits Immediately
```
❌ Error: "Container exited with code 1"
✅ Solution: Check logs (railway logs), verify MONGODB_URI is set
```

### MongoDB Connection Timeout
```
❌ Error: "connection timed out"
✅ Solution: 
- Verify MongoDB Atlas IP whitelist includes Railway (0.0.0.0/0)
- Check MONGODB_URI format: mongodb+srv://user:pass@cluster.mongodb.net/dbname
```

### CORS Errors in Frontend
```
❌ Error: "No 'Access-Control-Allow-Origin' header"
✅ Solution: Ensure Vercel frontend URL is in server.js CORS config
```

### Resume Upload Fails
```
❌ Error: "File too large" (> 5MB)
✅ Solution: Check file size, multer config limits (max 5MB in upload.js)
```

---

## Environment Variables Summary

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| MONGODB_URI | ✅ Yes | mongodb+srv://... | From MongoDB Atlas |
| FRONTEND_URL | ❌ No | https://vercel.app | For CORS, optional |
| PORT | ❌ No | 3001 | Railway sets automatically |
| NODE_ENV | ❌ No | production | Auto-detected |
| LOG_LEVEL | ❌ No | info | winston logger level |

---

## Local Development

Run locally before deploying to Railway:

```bash
# Install dependencies
npm install
npm install --prefix frontend

# Start backend
npm start          # Runs "node server.js"

# In another terminal, start frontend
npm run client     # Runs "npm start --prefix frontend"

# Or run both concurrently
npm run dev
```

**Local MongoDB**:
```bash
# If using local MongoDB instead of cloud
export MONGODB_URI=mongodb://localhost:27017/talentai
npm start
```

---

## Next Steps

1. ✅ Verify `server.js` runs locally without errors
2. ✅ Push to GitHub
3. ✅ Create Railway project and connect GitHub
4. ✅ Set environment variables
5. ✅ Deploy and test `/api/health`
6. ✅ Test candidate CRUD operations from Vercel frontend
7. ⏭️  For file persistence: Migrate from local storage to GCS/S3

---

## Support & Debugging

**Check logs**:
```bash
# Via Railway CLI
railway logs -f

# Via Dashboard
# Project → Deployments → [Latest] → Logs
```

**Test endpoints locally**:
```bash
curl -X GET http://localhost:3001/api/health
curl -X POST http://localhost:3001/api/candidates \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","jobRole":"SDE"}'
```

---

**Status**: ✅ Production Ready
**Last Updated**: March 20, 2026
