# TalentAI - AI-Powered Recruitment Platform

![TalentAI Banner](https://img.shields.io/badge/TalentAI-AI%20Recruitment%20Platform-7c3aed?style=for-the-badge&logo=robot&logoColor=white)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://anupmazumdar-ai-recruitment-agent.vercel.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com)
[![GCP](https://img.shields.io/badge/Google-Cloud-4285F4?style=for-the-badge&logo=googlecloud)](https://cloud.google.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

An intelligent end-to-end recruitment platform powered by OpenRouter multi-model AI.
100% free for candidates. Built solo by Anup Mazumdar.

[Live Demo](https://anupmazumdar-ai-recruitment-agent.vercel.app) · [LinkedIn](https://www.linkedin.com/in/anup-mazumdar-1033b5321/) · [GitHub](https://github.com/anupmazumdar)

---

## Overview

TalentAI is a full-stack AI-powered recruitment platform that automates the hiring pipeline from resume screening to AI interviews and final candidate scoring.
It is built as an MCA academic project at the University of Engineering & Management, Jaipur.

Sole Creator: Anup Mazumdar | MCA Student | UEM Jaipur (2025-2027)

---

## Key Features

- AI Resume Parsing: Multi-model AI extracts and scores skills, experience, and education automatically.
- AI Interview Engine: Natural language AI interviews with real-time response evaluation.
- Technical Quiz: Auto-graded quizzes with semantic similarity scoring.
- Candidate Scoring: Weighted multi-criteria scoring with detailed insights.
- Video Assessment: Live video recording and introduction upload.
- Recruiter Dashboard: Real-time analytics, candidate rankings, and pipeline management.
- Enterprise Security: JWT authentication, bcrypt encryption, and GCP storage.
- 100% Free for Candidates: No cost, no barrier for job seekers.

---

## 7-Stage Assessment Pipeline

```text
Stage 1          Stage 2          Stage 3          Stage 4
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Profile │────▶│ Resume  │────▶│  Video  │────▶│Technical│
│ Creation│     │ Upload  │     │  Intro  │     │  Quiz   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
                                                      │
                                                      ▼
Stage 7          Stage 6          Stage 5
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Results │◀────│  Live   │◀────│   AI    │
│Analytics│     │  Video  │     │Interview│
└─────────┘     └─────────┘     └─────────┘
```

| Stage | Description | AI Model |
| --- | --- | --- |
| 1. Profile Creation | Candidate registers and fills profile | - |
| 2. Resume Upload | AI parses and scores resume | Gemini Pro / Llama fallback |
| 3. Video Introduction | Candidate records intro video | GCP Storage |
| 4. Technical Quiz | Domain-specific auto-graded quiz | GPT-4o Mini |
| 5. AI Interview | AI conducts structured interview | Claude Sonnet / GPT-4o fallback |
| 6. Live Video Recording | Final video assessment | GCP Storage |
| 7. Results & Analytics | Scores, rankings, feedback | Multi-model |

---

## Tech Stack

### Frontend

| Technology | Purpose |
| --- | --- |
| React.js 18 | UI framework |
| Tailwind CSS | Styling |
| React Router | Navigation |
| Fetch API | API calls |

### Backend

| Technology | Purpose |
| --- | --- |
| Node.js + Express | REST API server |
| JWT + bcrypt | Authentication and security |
| OpenRouter API | Multi-model AI routing |
| Google Gemini Pro | Resume parsing support |
| GCP Cloud Storage | Video and file storage |

### Infrastructure

| Technology | Purpose |
| --- | --- |
| Vercel | Frontend deployment |
| Google Cloud Platform | File storage |
| OpenRouter | AI model gateway |

---

## Getting Started

### Prerequisites

- Node.js v18+
- npm v9+
- OpenRouter API key
- Google Gemini API key (optional fallback)
- GCP service account (for storage)

### Installation

```bash
# Clone the repository
git clone https://github.com/anupmazumdar/anupmazumdar-AIRecruitmentAgent.git
cd anupmazumdar-AIRecruitmentAgent

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../api
npm install
```

### Environment Setup

Create `.env` in the `frontend` directory:

```env
# Optional for frontend-only experimentation
REACT_APP_OPENROUTER_API_KEY=your_openrouter_key
REACT_APP_API_URL=http://localhost:5000
```

Create `.env` in the `api` directory:

```env
JWT_SECRET=your_jwt_secret
GOOGLE_GEMINI_API_KEY=your_gemini_key
OPENROUTER_API_KEY=your_openrouter_key
GOOGLE_CLOUD_PROJECT_ID=your_gcp_project_id
GOOGLE_CLOUD_BUCKET_NAME=your_bucket_name
# Optional for local key file auth only (not needed on Vercel)
GOOGLE_APPLICATION_CREDENTIALS=path_to_service_account.json
PORT=5000
```

### Running Locally

```bash
# Start backend (from /api)
npm start

# Start frontend (from /frontend)
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```text
anupmazumdar-AIRecruitmentAgent/
├── api/
│   ├── [...talentai].js       # Main Express API (serverless-compatible)
│   └── uploads/
├── frontend/                  # React.js frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Route pages
│   │   └── lib/
│   ├── public/
│   └── package.json
├── talentai.js                # Smart model router engine
├── modelStats.js              # Model performance tracker
├── abTest.js                  # A/B testing engine
├── costTracker.js             # Cost tracking and reporting
├── package.json
├── .gitignore
└── README.md
```

---

## AI Evaluation Engine

TalentAI uses a smart multi-model routing system via OpenRouter:

```text
RESUME_PARSING      → google/gemini-pro                 (fast extraction)
CANDIDATE_SCORING   → openai/gpt-4o                     (best reasoning)
INTERVIEW_EVAL      → anthropic/claude-3-sonnet         (language understanding)
QUIZ_GRADING        → openai/gpt-4o-mini                (cost efficient)
FEEDBACK_GENERATION → mistralai/mixtral-8x7b-instruct   (detailed output)
BIAS_DETECTION      → anthropic/claude-3-sonnet         (ethical reasoning)
JD_MATCHING         → meta-llama/llama-3-70b-instruct   (bulk ranking)
```

Accuracy features:

- temperature `0.1` for consistent, deterministic outputs on analytical tasks.
- Automatic fallback to secondary model on failure.
- Up to 3 retry attempts across primary and fallback models.
- JSON schema validation on every response.
- Cost-aware routing for bulk operations and optional cheap mode.

---

## Security

- JWT authentication with secure token handling.
- bcrypt password hashing (salt rounds: 12).
- Environment variables for all secrets (never hardcoded).
- CORS protection on all API routes.
- Input validation and sanitization middleware.
- Rate limiting on authentication endpoints.

---

## Scoring System

| Component | Weight | Model |
| --- | --- | --- |
| Skills Match | 40% | Gemini Pro |
| Experience | 25% | GPT-4o |
| Education | 15% | GPT-4o |
| Cultural Fit | 20% | Claude Sonnet |

Grading Scale: A (85+) · B (70-84) · C (55-69) · D (40-54) · F (<40)
Shortlist Threshold: 68+ weighted score

---

## About the Creator

Anup Mazumdar
MCA Student - University of Engineering & Management, Jaipur (2025-2027)
Google Cybersecurity Certified | Full-Stack Developer | ML Engineer

[![GitHub](https://img.shields.io/badge/GitHub-anupmazumdar-181717?style=flat&logo=github)](https://github.com/anupmazumdar)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-anup--mazumdar-0A66C2?style=flat&logo=linkedin)](https://www.linkedin.com/in/anup-mazumdar-1033b5321/)

This project was built entirely solo as an MCA academic project.
No collaborators. All code, design, and architecture by Anup Mazumdar.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

If you found this useful, give it a star.
Built with care by [Anup Mazumdar](https://github.com/anupmazumdar).
