# TalentAI - AI-Powered Recruitment Platform

Complete recruitment platform with resume analysis, technical quizzes, AI interviews, and video assessments. Now with **Google Cloud Storage** integration for persistent data storage!

## ✨ Features

- 🔐 **User Authentication** - Separate portals for candidates and recruiters
- 📄 **Smart Resume Analysis** - ATS scoring with project-focused AI analysis
- 🎥 **Video Interview Upload** - Upload pre-recorded video introductions
- 📝 **Technical Assessments** - AI-generated position-specific quizzes
- 💬 **AI Interviews** - Natural conversation with AI interviewer
- 🎬 **Live Video Recording** - Record answers to interview questions
- 📊 **Comprehensive Scoring** - Multi-dimensional candidate evaluation
- ☁️ **Cloud Storage** - Google Cloud Storage for file and data persistence
- 💳 **Subscription Plans** - Basic, Premium, and Pro tiers

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Google Cloud account (optional, for cloud storage)

### Installation

1. **Clone or download the project**

2. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` file** with your API keys:
   ```env
   # Required: Google Gemini API Key
   GOOGLE_GEMINI_API_KEY=your_gemini_api_key
   
   # Optional: Google Cloud Storage (see GOOGLE_CLOUD_SETUP.md)
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   GOOGLE_CLOUD_BUCKET_NAME=your-bucket-name
   GOOGLE_APPLICATION_CREDENTIALS=./gcs-service-account-key.json
   ```

5. **Get your Google Gemini API key:**
   - Go to https://makersuite.google.com/app/apikey
   - Create a new API key
   - Paste it in your `.env` file

6. **Start the backend server:**
   ```bash
   npm start
   ```
   
   You should see:
   ```
   ✅ Google Cloud Storage initialized (or ⚠️ Using local storage)
   TalentAI Backend Server Running on Port 3001
   ```

7. **Install frontend dependencies:**
   ```bash
   cd ../frontend
   npm install
   ```

8. **Start the frontend:**
   ```bash
   npm start
   ```

9. **Open your browser to** http://localhost:3000

🎉 **You're ready to go!**

---

## ☁️ Setting Up Google Cloud Storage (Optional but Recommended)

Without Google Cloud Storage, your data will be stored in memory and lost when the server restarts. To enable persistent cloud storage:

👉 **See [GOOGLE_CLOUD_SETUP.md](GOOGLE_CLOUD_SETUP.md) for complete setup instructions**

Quick steps:
1. Create Google Cloud project
2. Enable Cloud Storage API
3. Create a storage bucket
4. Create service account with Storage Admin role
5. Download JSON key file
6. Add credentials to `.env`

**Benefits:**
- ✅ Data persists across server restarts
- ✅ Files backed up in the cloud
- ✅ Scalable to multiple servers
- ✅ Free tier: 5GB storage + generous operations quota

---

## 📁 Project Structure

```
TalentAI/
├── backend/
│   ├── server.js              # Express server with GCS integration
│   ├── package.json
│   ├── .env.example           # Environment variables template
│   └── gcs-service-account-key.json  # GCS credentials (not in Git)
├── frontend/
│   ├── src/
│   │   ├── App.js             # Main React app (UPDATED)
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
├── GOOGLE_CLOUD_SETUP.md      # Cloud storage setup guide
├── CHANGES.md                 # Changelog
└── README.md                  # This file
```

---

## 🔑 Environment Variables

Required:
- `GOOGLE_GEMINI_API_KEY` - For AI features

Optional (for cloud storage):
- `GOOGLE_CLOUD_PROJECT_ID` - Your GCP project ID
- `GOOGLE_CLOUD_BUCKET_NAME` - Your storage bucket name
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account key

Optional (alternative AI providers):
- `OPENAI_API_KEY` - For OpenAI GPT models
- `ANTHROPIC_API_KEY` - For Claude models
- `AI_PROVIDER` - Choose: `gemini` (default), `openai`, or `claude`

---

## 🎯 User Guide

### For Candidates (FREE)

1. **Sign up** as a candidate
2. **Complete profile** (name, email, position)
3. **Upload resume** - Get instant ATS analysis
4. **Upload video** (optional) - Record 1-3 min introduction
5. **Take technical quiz** - Position-specific questions
6. **AI interview** - Chat with AI interviewer
7. **Video recording** (optional) - Record answers to questions
8. **View results** - See comprehensive score breakdown

### For Recruiters (Paid Plans)

1. **Choose a plan** (Basic $29/mo, Premium $79/mo, Pro $199/mo)
2. **Sign up** as recruiter
3. **View dashboard** - See all candidate applications
4. **Review scores** - Resume, Quiz, Interview, Video
5. **Download reports** - Export candidate data
6. **Manage subscriptions** - Upgrade/downgrade anytime

---

## 📊 What Gets Stored in Cloud?

### Data Files (in `data/` folder):
- **users.json** - All registered users (hashed passwords)
- **candidates.json** - Candidate records with scores and analysis
- **subscriptions.json** - Active subscription data

### Uploaded Files:
- **resumes/** - Resume PDFs, DOCs organized by candidate
- **videos/** - Video interviews organized by candidate

All files are automatically:
- ✅ Backed up to Google Cloud Storage
- ✅ Loaded on server start
- ✅ Saved after each operation
- ✅ Accessible via signed URLs (secure, time-limited)

---

## 🐛 Bug Fixes in This Version

### Fixed: "Candidate not found" Error
**Problem:** Resume upload failed with error.

**Solution:** ProfileStage now creates candidate record in backend before resume upload. All API calls use real candidate IDs.

### Added: Video Upload Stage
**New Feature:** Upload pre-recorded video interviews after resume, with AI analysis and scoring.

See [CHANGES.md](CHANGES.md) for detailed changelog.

---

## 🔒 Security Notes

1. **Never commit** `.env` or `*-service-account-key.json` files
2. **Passwords** are hashed with bcrypt (10 rounds)
3. **JWT tokens** expire after 7 days
4. **File uploads** validated by type and size
5. **Google Cloud** signed URLs expire after 7 days

---

## 💰 Pricing

### For Candidates: FREE
- Unlimited applications
- Full assessment suite
- All features included

### For Recruiters:
- **Basic** - $29/mo: 10 candidates, ATS analysis, basic quiz
- **Premium** - $79/mo: 50 candidates, AI features, video analysis
- **Pro** - $199/mo: Unlimited candidates, all features, API access

---

## 🛠️ Tech Stack

**Frontend:**
- React
- Tailwind CSS
- Lucide React icons

**Backend:**
- Node.js + Express
- JWT authentication
- Multer file uploads
- Google Cloud Storage

**AI/ML:**
- Google Gemini (default)
- OpenAI GPT (optional)
- Anthropic Claude (optional)

**Cloud:**
- Google Cloud Storage (files + data)
- Works without cloud (local storage fallback)

---

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login

### Candidates
- `POST /api/candidates` - Create candidate profile
- `POST /api/candidates/:id/resume` - Upload & analyze resume
- `POST /api/candidates/:id/video-interview` - Upload video
- `POST /api/generate-quiz` - Generate technical quiz

### Subscriptions
- `POST /api/subscriptions` - Create subscription

### Health
- `GET /api/health` - Server health check

---

## 🚨 Troubleshooting

### Backend won't start
- Check `.env` has `GOOGLE_GEMINI_API_KEY`
- Ensure port 3001 is not in use
- Run `npm install` in backend folder

### Frontend won't start
- Ensure backend is running on port 3001
- Run `npm install` in frontend folder
- Check for port 3000 conflicts

### "Candidate not found" error
- This should be fixed in the latest version
- Ensure you're using the updated `App.js`

### Google Cloud Storage not working
- See [GOOGLE_CLOUD_SETUP.md](GOOGLE_CLOUD_SETUP.md)
- Check service account has "Storage Admin" role
- Verify bucket name and project ID in `.env`

### Data lost on restart
- If not using GCS, data is stored in memory
- Set up Google Cloud Storage for persistence
- Or use a database (MongoDB, PostgreSQL)

---

## 🔮 Future Enhancements

- [ ] PostgreSQL/MongoDB integration
- [ ] Email notifications
- [ ] Calendar integration for interviews
- [ ] Advanced analytics dashboard
- [ ] Mobile app
- [ ] Integration with ATS systems
- [ ] Candidate ranking algorithms
- [ ] Team collaboration features

---

## 📄 License

MIT License - Feel free to use for personal or commercial projects

---

## 🤝 Support

For issues or questions:
1. Check [GOOGLE_CLOUD_SETUP.md](GOOGLE_CLOUD_SETUP.md) for cloud storage help
2. Review [CHANGES.md](CHANGES.md) for recent updates
3. Check the troubleshooting section above

---

**Built with ❤️ using AI-powered technologies**
