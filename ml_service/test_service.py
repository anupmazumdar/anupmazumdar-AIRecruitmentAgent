#!/usr/bin/env python
"""
ML Service Test Script
Tests the resume-job match score endpoint with various scenarios
"""

import json
import requests

BASE_URL = "http://localhost:8000"

def test_health():
    """Test health endpoint"""
    print("\n🏥 Testing Health Endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        response.raise_for_status()
        data = response.json()
        print(f"✅ Status: {data['status']}")
        print(f"   Service: {data['service']}")
        print(f"   Version: {data['version']}")
        return True
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False


def test_match(resume_text, job_description, label=""):
    """Test match endpoint"""
    print(f"\n🎯 Testing Match Score {label}...")
    try:
        response = requests.post(
            f"{BASE_URL}/match",
            json={
                "resume_text": resume_text,
                "job_description": job_description
            },
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        score = data.get("score", 0)
        label_result = data.get("label", "Unknown")
        
        print(f"✅ Match Score: {score:.2%}")
        print(f"   Label: {label_result}")
        
        # Verify label matches score threshold
        if score > 0.7 and label_result == "Excellent":
            print("   ✓ Threshold validation passed")
        elif 0.4 < score <= 0.7 and label_result == "Good":
            print("   ✓ Threshold validation passed")
        elif score <= 0.4 and label_result == "Needs Improvement":
            print("   ✓ Threshold validation passed")
        else:
            print(f"   ⚠ Warning: Label may not match score threshold")
        
        return True
    except Exception as e:
        print(f"❌ Match test failed: {e}")
        return False


def main():
    """Run all tests"""
    print("=" * 60)
    print("TalentAI ML Service Test Suite")
    print("=" * 60)
    
    all_passed = True
    
    # Test 1: Health check
    all_passed &= test_health()
    
    # Test 2: High match (Excellent)
    all_passed &= test_match(
        resume_text="""
        Senior Python Developer with 8 years experience
        - Django and FastAPI expertise
        - AWS cloud services (EC2, Lambda, RDS)
        - Docker containerization and Kubernetes
        - REST API design and implementation
        - PostgreSQL and database optimization
        - Machine learning with TensorFlow and scikit-learn
        - Microservices architecture
        """,
        job_description="""
        Senior Python Developer Position
        Required Skills:
        - 7+ years Python development (Django/FastAPI)
        - AWS cloud expertise
        - Docker and containerization
        - REST API design
        - Database optimization
        - Machine learning knowledge
        - Microservices design
        """,
        label="(High Match - Should be Excellent)"
    )
    
    # Test 3: Medium match (Good)
    all_passed &= test_match(
        resume_text="""
        Full Stack Developer
        - 5 years JavaScript and Node.js
        - React frontend development
        - MongoDB databases
        - Some Python experience
        - AWS basics
        """,
        job_description="""
        Python Developer needed
        - Python 3+ required
        - Django or FastAPI
        - Backend REST APIs
        - Database design
        """,
        label="(Medium Match - Should be Good)"
    )
    
    # Test 4: Low match (Needs Improvement)
    all_passed &= test_match(
        resume_text="""
        HTML/CSS Designer
        - Web design skills
        - Adobe Creative Suite
        - Figma prototyping
        """,
        job_description="""
        Senior Python Backend Engineer
        - 10 years Python development
        - AWS microservices
        - System design
        - Performance optimization
        """,
        label="(Low Match - Should be Needs Improvement)"
    )
    
    # Test 5: Empty/Invalid input
    print("\n⚠️  Testing Edge Cases...")
    try:
        response = requests.post(
            f"{BASE_URL}/match",
            json={"resume_text": "", "job_description": ""},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("score") == 0.0:
                print("✅ Empty input handling: Returns 0.0 score")
            else:
                print("⚠ Empty input returns non-zero score")
    except Exception as e:
        print(f"Edge case test: {e}")
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ All tests completed successfully!")
    else:
        print("⚠ Some tests had issues - check output above")
    print("=" * 60)


if __name__ == "__main__":
    main()
