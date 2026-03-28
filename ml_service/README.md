# ML Service Setup & Testing Guide

## Local Development Setup

### 1. Install Dependencies
```bash
cd ml_service
pip install -r requirements.txt
```

### 2. Run the FastAPI Service Locally
```bash
uvicorn main:app --reload
```

The service will start on **http://localhost:8000**

### 3. Test the Service

#### Health Check
```bash
curl http://localhost:8000/health
```

#### Test Match Score Endpoint
```bash
curl -X POST http://localhost:8000/match \
  -H "Content-Type: application/json" \
  -d '{
    "resume_text": "Python developer with 5 years experience in Django, FastAPI, and AWS. Experienced in REST APIs, PostgreSQL, and Docker containerization.",
    "job_description": "Looking for a senior Python developer with expertise in FastAPI, Cloud services, and microservices architecture. Must have experience with REST APIs and database optimization."
  }'
```

Expected response:
```json
{
  "score": 0.75,
  "label": "Excellent"
}
```

### 4. Backend Integration

Set the ML service URL in your Node.js backend `.env` file:
```
ML_SERVICE_URL=http://localhost:8000
```

Then test the backend endpoint:
```bash
curl -X POST http://localhost:3001/api/ml/match-score \
  -H "Content-Type: application/json" \
  -d '{
    "resumeText": "Python developer with 5 years experience...",
    "jobDescription": "Looking for a senior Python developer..."
  }'
```

### 5. Deployment to Render

1. Create a new Render.com service:
   - Select **Web Service** → **Python**
   - Connect your GitHub repo
   - Build command: `pip install -r ml_service/requirements.txt`
   - Start command: `cd ml_service && uvicorn main:app --host 0.0.0.0 --port $PORT`

2. Add environment variables (if needed):
   - No special env vars required for basic setup

3. Update your Node.js `.env` with the Render URL:
   ```
   ML_SERVICE_URL=https://talentai-ml-service.onrender.com
   ```

## API Specifications

### POST /match
Compute resume-job description match score

**Request:**
```json
{
  "resume_text": "string",
  "job_description": "string"
}
```

**Response:**
```json
{
  "score": 0.0-1.0,
  "label": "Excellent|Good|Needs Improvement"
}
```

**Score Thresholds:**
- `score > 0.7` → "Excellent"
- `0.4 < score ≤ 0.7` → "Good"
- `score ≤ 0.4` → "Needs Improvement"

## Architecture

- **TF-IDF Vectorization**: Converts text to numerical vectors based on term frequency
- **Cosine Similarity**: Measures angular similarity between resume and job description vectors
- **Ngram Support**: Uses unigrams and bigrams for better context matching
- **Stopword Removal**: Filters common English words to focus on relevant terms
