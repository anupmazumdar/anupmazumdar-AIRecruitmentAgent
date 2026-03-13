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
- Technical Quiz: Auto-graded quizzes with configurable durations and semantic similarity scoring.
- Candidate Scoring: Weighted multi-criteria scoring with detailed insights.
- Video Assessment: Live video recording, introduction upload, and AI-powered video grading.
- Career Coach: AI-powered career coaching panel available from Stage 2 onwards.
- Upgrade Skills Roadmap: Personalised learning roadmap with curated resource links generated after results, helping candidates upskill based on their assessment gaps.
- Recruiter Dashboard: Real-time analytics, candidate rankings, and pipeline management.
- Per-Recruiter Candidate Visibility: Superadmin can restrict which candidates each recruiter can view.
- Superadmin Panel: Full platform control — manage recruiters, candidates, question bank, and access policies.
- Question Bank Management: Admins and recruiters can update and refresh quiz questions; no arbitrary add/delete.
- Enterprise Security: JWT authentication, bcrypt encryption, and GCP storage.
- 100% Free for Candidates: No cost, no barrier for job seekers.

---

## 9-Stage Assessment Pipeline

```text
Stage 1          Stage 2          Stage 3          Stage 4          Stage 5
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Profile │────▶│ Career  │────▶│ Resume  │────▶│  Video  │────▶│Technical│
│ Creation│     │  Coach  │     │ Upload  │     │  Intro  │     │  Quiz   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
                                                                       │
                                                                       ▼
Stage 9          Stage 8          Stage 7          Stage 6
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Upgrade │◀────│ Results │◀────│  Live   │◀────│   AI    │
│  Skills │     │Analytics│     │  Video  │     │Interview│
└─────────┘     └─────────┘     └─────────┘     └─────────┘
```

| Stage | Description | AI Model |
| --- | --- | --- |
| 1. Profile Creation | Candidate registers and fills profile | - |
| 2. Career Coach | AI-powered personalised guidance, skill gap analysis, and preparation tips before assessment | Claude Sonnet |
| 3. Resume Upload | AI parses and scores resume | Gemini Pro / Llama fallback |
| 4. Video Introduction | Candidate records intro video; AI-graded for communication quality | GCP Storage + GPT-4o |
| 5. Technical Quiz | Domain-specific auto-graded quiz with configurable time limits | GPT-4o Mini |
| 6. AI Interview | AI conducts structured interview | Claude Sonnet / GPT-4o fallback |
| 7. Live Video Recording | Final video assessment with AI scoring | GCP Storage + GPT-4o |
| 8. Results & Analytics | Scores, rankings, and detailed feedback | Multi-model |
| 9. Upgrade Skills | AI-generated personalised learning roadmap with curated resource links based on assessment gaps | Claude Sonnet |

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
│   ├── middleware/
│   │   └── security.js        # Rate limiting, CORS, and security middleware
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

## Superadmin & Admin System

TalentAI has a three-tier access model: **Candidate → Recruiter → Superadmin**.

### User Roles

| Role | Capabilities |
| --- | --- |
| Candidate | Complete the 9-stage pipeline, access Career Coach (Stage 2), view results, unlock Upgrade Skills roadmap |
| Recruiter | View allowed candidates, manage question bank (update/refresh), run AI grading |
| Superadmin | All recruiter capabilities + full platform control (see below) |

### Superadmin Capabilities

- **Recruiter Management** — Grant or revoke platform access, add optional access notes, remove any recruiter account (with cascade cleanup of related data).
- **Candidate Account Management** — Grant or revoke candidate access, remove any candidate account.
- **Per-Recruiter Candidate Visibility** — Control exactly which candidates each recruiter can view.
  - Default: recruiter sees all candidates.
  - Restrict mode: superadmin picks a whitelist of specific candidates per recruiter via a candidate checklist in the dashboard.
- **Question Bank Management** — Full access to update, replace, and refresh quiz questions for any domain via the embedded Question Panel.
- **Configurable Quiz Durations** — Set time limits for each quiz independently.
- **Platform Stats** — Real-time overview of recruiter count, active access, candidate totals, and average score.

### Recruiter Capabilities

- View only candidates the superadmin has permitted (or all candidates if no restriction is set).
- Update and refresh quiz questions for their domain (add/delete restricted to prevent accidental data loss).
- View detailed candidate profiles including all assessment stages and AI scores.
- Run AI video grading on uploaded candidate videos.

### Career Coach

After a candidate completes all 8 assessment stages, the **Career Coach** panel (Stage 2) also remains accessible for ongoing guidance. It is powered by the same OpenRouter AI engine and provides personalised improvement guidance, skill gap analysis, and next-step recommendations based on the candidate's actual assessment results.

---

## Upgrade Skills & Learning Roadmap

After viewing their results (Stage 8), candidates unlock a personalised **Upgrade Skills** roadmap (Stage 9). This is a separate, dedicated section — not embedded inside the results dashboard — that gives every candidate a clear path to improvement.

### What the Roadmap Covers

The AI analyses the candidate's actual scores across all assessment stages and generates a targeted upskilling plan with direct resource links:

#### Data Structures & Algorithms
| Resource | Type | Link |
| --- | --- | --- |
| LeetCode | Practice problems | https://leetcode.com |
| NeetCode.io | Structured DSA roadmap + video solutions | https://neetcode.io |
| GeeksforGeeks | Tutorials and interview prep | https://www.geeksforgeeks.org |
| CS50 (Harvard) | Free foundational CS course | https://cs50.harvard.edu |

#### Web Development
| Resource | Type | Link |
| --- | --- | --- |
| The Odin Project | Full-stack curriculum (free) | https://www.theodinproject.com |
| MDN Web Docs | Reference and guides | https://developer.mozilla.org |
| freeCodeCamp | Hands-on web dev certifications | https://www.freecodecamp.org |
| full stack open | Modern web dev with React & Node | https://fullstackopen.com |

#### System Design
| Resource | Type | Link |
| --- | --- | --- |
| ByteByteGo | System design concepts and diagrams | https://bytebytego.com |
| Grokking System Design | Interview-focused system design | https://www.designgurus.io |
| System Design Primer | GitHub open-source guide | https://github.com/donnemartin/system-design-primer |

#### Machine Learning & AI
| Resource | Type | Link |
| --- | --- | --- |
| fast.ai | Practical deep learning (free) | https://www.fast.ai |
| Coursera — Andrew Ng ML | Foundational ML course | https://www.coursera.org/specializations/machine-learning-introduction |
| Kaggle Learn | Hands-on ML micro-courses | https://www.kaggle.com/learn |
| Hugging Face | NLP and transformer models | https://huggingface.co/learn |

#### Cloud & DevOps
| Resource | Type | Link |
| --- | --- | --- |
| Google Cloud Skills Boost | GCP training and certifications | https://cloudskillsboost.google |
| AWS Skill Builder | AWS free training | https://skillbuilder.aws |
| Microsoft Learn | Azure learning paths | https://learn.microsoft.com |
| KodeKloud | DevOps and Kubernetes labs | https://kodekloud.com |

#### Core Computer Science
| Resource | Type | Link |
| --- | --- | --- |
| MIT OpenCourseWare | University-level CS courses (free) | https://ocw.mit.edu |
| Teach Yourself CS | Curated self-study curriculum | https://teachyourselfcs.com |
| Roadmap.sh | Developer roadmaps by role | https://roadmap.sh |

### How It Works

1. After Stage 8 (Results & Analytics), the candidate's gap areas are identified from their scores.
2. The AI generates a prioritised skill list and maps each gap to relevant resources.
3. The roadmap is presented as an interactive checklist — candidates can mark topics as in-progress or complete.
4. Resources are filtered by the candidate's target role (e.g., backend engineer, data scientist, full-stack developer).

---

## Video AI Grading

Uploaded candidate videos are analysed by AI to produce a structured video interview score:

- Transcription via GCP.
- Content evaluation for communication quality, confidence, and relevance.
- Score is factored into the overall weighted candidate ranking.

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

## Recent Updates

### v2.1 — Upgrade Skills Roadmap (Stage 9)
- New final stage: personalised AI-generated learning roadmap unlocked after results.
- Curated resources across DSA, web dev, system design, ML/AI, cloud, and core CS.
- Roadmap is separate from the results dashboard — dedicated upskilling section.
- Interactive checklist: candidates track progress per topic.
- Resources filtered by candidate's target role and assessment gap areas.
- Pipeline updated from 8-stage to 9-stage.

### v2.0 — Superadmin Access Control & Candidate Visibility
- Superadmin can now remove any recruiter or candidate account (with cascade cleanup of related views and subscriptions).
- New `PUT /api/superadmin/recruiters/:id/candidate-access` endpoint — superadmin sets a per-recruiter candidate whitelist.
- `GET /api/recruiter/candidates` now enforces `allowedCandidateIds` filtering; `null` means unrestricted.
- Superadmin dashboard: collapsible Candidate Visibility panel per recruiter with "All Candidates" vs. restricted checklist mode.
- Questions tab added to superadmin dashboard with full `AdminQuestionPanel` embedded.
- Recruiter list, recruiter detail panel, and candidate account list all include Remove buttons.

### v1.5 — Question Bank, Quiz Durations & Career Coach
- Question bank policy enforced: recruiters and admins can update/refresh questions; arbitrary add/delete is restricted.
- Quiz duration is now configurable per domain — superadmin sets time limits independently per quiz.
- Career Coach feature: unlocked post-assessment, provides AI-driven personalised guidance.
- Video AI grading: candidate-uploaded videos are now scored by AI and factored into the overall ranking.

### v1.1 — Auth & Pipeline Fixes
- Fixed `authState` prop wiring in `TechnicalQuizStage` to prevent auth context loss during quiz.
- General security middleware hardening (`api/middleware/security.js`): rate limiting and CORS improvements.

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
Built with care ❤️ by [Anup Mazumdar](https://github.com/anupmazumdar).
