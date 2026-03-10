# Vercel Deployment Guide

Your project is now configured to be deployed on Vercel as a monorepo! The frontend will be built as a static site, and the backend Express App will run as a Serverless API Function.

## Deployment Steps

1. **Push to GitHub**: 
   Push this entire folder to a GitHub repository.

2. **Connect to Vercel**:
   Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click "Add New... -> Project".
   Import the GitHub repository you just pushed.

3. **Configure Project Settings**:
   - **Framework Preset**: Vercel should automatically detect `Create React App` from `frontend` or `Other`. You can leave it as-is.
   - **Root Directory**: Ensure the root directory is set to your project's root folder (`/`), not `/frontend` or `/backend`. The custom `vercel.json` file will take care of building the frontend and linking your API logic.
   
4. **Environment Variables**:
   Under the "Environment Variables" section in Vercel, copy and paste all the keys from your `backend/.env` file:
   - `JWT_SECRET`
   - `AI_PROVIDER`
   - `OPENAI_API_KEY` (if used)
   - `GOOGLE_GEMINI_API_KEY` (if used)
   - `GOOGLE_CLOUD_PROJECT_ID` (if used)
   - `GOOGLE_CLOUD_BUCKET_NAME` (if used)
   - *Note: Don't paste local file paths for Cloud Credentials on Vercel. Instead, you can base64 encode the service account JSON and decode it on the server, or use standard environment keys for the cloud provider.*

5. **Deploy**:
   Click the "Deploy" button. Vercel will install dependencies, build your React frontend, and deploy your Express backend.

## What was modified:
- Created a `vercel.json` in root to map `/api/*` requests to your Node.JS serverless backend and map everything else to the built React frontend.
- Created a `package.json` in the root folder to handle installing dependencies for both subprojects.
- Updated `backend/server.js`'s `multer` configuration to correctly use `/tmp` folder (`os.tmpdir()`) when running on Vercel. (Serverless functions do not have write access to `/uploads`).
- Prevented `app.listen` from triggering during Vercel Serverless environment execution.
- Dynamically switched `API_URL` in `frontend/src/App.js` to securely point to the `/api` route in production without hardcoding localhost.
