"""
TalentAI ML Resume-Job Match Score Service
Uses TF-IDF vectorization and cosine similarity for matching
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

app = FastAPI(
    title="TalentAI ML Service",
    description="Resume-Job Match Score Computation",
    version="1.0.0"
)

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MatchRequest(BaseModel):
    """Request model for match endpoint"""
    resume_text: str
    job_description: str


class MatchResponse(BaseModel):
    """Response model for match endpoint"""
    score: float
    label: str


def compute_match_score(resume_text: str, job_description: str) -> tuple[float, str]:
    """
    Compute match score between resume and job description using TF-IDF and cosine similarity.
    
    Args:
        resume_text: The candidate's resume text
        job_description: The job description text
    
    Returns:
        tuple: (score, label) where score is 0-1 and label is qualitative
    """
    # Normalize input texts
    resume_text = str(resume_text or "").strip()
    job_description = str(job_description or "").strip()
    
    if not resume_text or not job_description:
        return 0.0, "Invalid Input"
    
    try:
        # Tokenize and vectorize using TF-IDF
        vectorizer = TfidfVectorizer(
            lowercase=True,
            stop_words='english',
            ngram_range=(1, 2),  # Unigrams and bigrams
            min_df=1,
            max_df=1.0
        )
        
        # Fit and transform both texts
        tfidf_matrix = vectorizer.fit_transform([resume_text, job_description])
        
        # Compute cosine similarity
        similarity = cosine_similarity(tfidf_matrix[0], tfidf_matrix[1])[0][0]
        
        # Clamp score to 0-1 range
        score = float(np.clip(similarity, 0.0, 1.0))
        
        # Assign qualitative label based on thresholds
        if score > 0.7:
            label = "Excellent"
        elif score > 0.4:
            label = "Good"
        else:
            label = "Needs Improvement"
        
        return score, label
    
    except Exception as e:
        print(f"Error computing match score: {str(e)}")
        return 0.0, "Error"


@app.post("/match", response_model=MatchResponse)
async def match_resume_to_job(request: MatchRequest) -> MatchResponse:
    """
    Compute resume-job match score.
    
    Args:
        request: MatchRequest with resume_text and job_description
    
    Returns:
        MatchResponse with score (0-1) and qualitative label
    """
    try:
        score, label = compute_match_score(request.resume_text, request.job_description)
        return MatchResponse(score=score, label=label)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Match computation failed: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "TalentAI ML Match Service",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
