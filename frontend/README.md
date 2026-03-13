# TalentAI Frontend Guide

TalentAI is an AI-powered recruitment platform with candidate and recruiter workflows, resume analysis, quizzes, interviews, and video-based assessments.

## Overview

This frontend app is built with React and talks to the TalentAI API server in the `api` folder.

## Features

- Candidate and recruiter authentication flows
- Candidate journey: profile, career guidance, resume, quiz, interview, video, results
- Recruiter dashboard and plan-based access
- Support chatbot integration
- Responsive UI built with Tailwind CSS

## Tech Stack

| Technology | Purpose |
| --- | --- |
| React 18 | Frontend framework |
| Tailwind CSS | Styling and responsive layout |
| Fetch API | Backend communication |
| Lucide React | Icon set |

## Prerequisites

- Node.js v18 or later
- npm v9 or later
- Running TalentAI backend API

## Local Setup

1. Clone the repository and open the project root.
2. Install frontend dependencies.
3. Configure frontend environment variables.
4. Start frontend development server.

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:3001
```

Optional variables:

```env
# Optional: for direct frontend experiments only
REACT_APP_OPENROUTER_API_KEY=your_openrouter_key
```

Run frontend:

```bash
npm start
```

Frontend runs on [http://localhost:3000](http://localhost:3000).

## Backend Dependency

Frontend expects the backend API to be running from the repository `api` folder.

From repository root:

```bash
cd api
npm install
npm start
```

Backend default: `http://localhost:3001`

## Core User Flows

### Candidate flow

1. Register or sign in as candidate.
2. Complete profile.
3. Use career coach guidance.
4. Upload resume and run analysis.
5. Complete technical quiz.
6. Complete interview stages (text and video).
7. View final scoring and recommendations.

### Recruiter flow

1. Register or sign in as recruiter.
2. Select and activate a subscription plan.
3. Review candidate pipeline and scores.
4. Monitor rankings and hiring insights.

## Project Structure

```text
frontend/
 public/
 src/
    components/
    pages/
    App.js
    App.css
    index.js
 package.json
 README.md
```

## Environment Notes

- Keep secrets in backend `.env` whenever possible.
- Do not commit `.env` files.
- Frontend should use `REACT_APP_API_URL` to target the backend.

## Auth0 React SDK Setup

This project now includes the official Auth0 React SDK (`@auth0/auth0-react@2.x`) and wraps the app with `Auth0Provider` in [src/index.js](src/index.js).

Configured Auth0 app:

- Domain: `dev-shjk32vx4oscfrde.us.auth0.com`
- Client ID: `KHC4ncaBYv0W4NqgVSLD5vJI8SuqPHDk`
- Redirect URI: `https://anupmazumdar-ai-recruitment-agent.vercel.app/`
- Logout return URI: `https://anupmazumdar-ai-recruitment-agent.vercel.app/`

Required frontend env vars:

```env
REACT_APP_AUTH0_DOMAIN=dev-shjk32vx4oscfrde.us.auth0.com
REACT_APP_AUTH0_CLIENT_ID=KHC4ncaBYv0W4NqgVSLD5vJI8SuqPHDk
REACT_APP_AUTH0_REDIRECT_URI=https://anupmazumdar-ai-recruitment-agent.vercel.app/
REACT_APP_AUTH0_LOGOUT_RETURN_TO=https://anupmazumdar-ai-recruitment-agent.vercel.app/
```

Important: your Auth0 application is currently configured only for the Vercel origin above. Running this app on a different origin (for example `http://localhost:3000`) will cause Auth0 callback/logout/web-origin mismatch errors unless you add that origin in the Auth0 application settings.

Auth0 handoff behavior in this app:

- First-time Auth0 users must explicitly choose Candidate or Recruiter before creating a TalentAI API session.
- Recruiter onboarding through Auth0 also requires a company name, and backend approval depends on server-side `AUTH0_ALLOWED_RECRUITER_DOMAINS` configuration.

## Troubleshooting

### Frontend does not start

- Ensure dependencies are installed with `npm install`.
- Ensure port 3000 is available.
- Check terminal output for missing package errors.

### API calls fail in frontend

- Verify backend is running on the configured URL.
- Verify `REACT_APP_API_URL` value in `frontend/.env`.
- Restart frontend after `.env` changes.

### CORS or auth issues

- Confirm backend CORS is enabled.
- Re-login if token/session is stale.

## Security Guidance

- Never hardcode API keys.
- Keep authentication logic server-side.
- Use HTTPS in production.

## License

This project is licensed under the MIT License. See [README.md](../README.md) for full project details.
