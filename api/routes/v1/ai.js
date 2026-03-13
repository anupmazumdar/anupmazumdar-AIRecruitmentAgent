'use strict';

const express = require('express');

const router = express.Router();

const { authenticateToken, requireRole } = require('../../middleware/auth');
const { aiRateLimiter } = require('../../middleware/security');
const { detectBias } = require('../../services/biasDetection');
const { matchCandidates } = require('../../services/jdMatching');
const { generateFeedback } = require('../../services/feedbackGenerator');
const {
  getModelStats: getTalentRouterModelStats,
  getCostReport: getTalentRouterCostReport,
  getABTestResults: getTalentRouterABTestResults,
} = require('../../../talentai');

// ---------------------------------------------------------------------------
// POST /api/v1/ai/bias-detect
// Auth: recruiter or superadmin
// ---------------------------------------------------------------------------
router.post(
  '/bias-detect',
  authenticateToken,
  requireRole('recruiter', 'superadmin'),
  aiRateLimiter,
  async (req, res, next) => {
    try {
      const { job_description, candidate_profile, evaluation_scores } =
        req.body;

      if (!job_description) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'job_description is required',
        });
      }
      if (!candidate_profile) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'candidate_profile is required',
        });
      }

      const result = await detectBias({
        job_description,
        candidate_profile,
        evaluation_scores,
      });

      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/ai/jd-match
// Auth: recruiter
// Rate: 10 / min (half the aiRateLimiter — applied as separate limiter)
// ---------------------------------------------------------------------------
const rateLimit = require('express-rate-limit');

const jdMatchRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'JD matching limit: 10 requests per minute.',
      retryAfter: 60,
    });
  },
});

router.post(
  '/jd-match',
  authenticateToken,
  requireRole('recruiter'),
  jdMatchRateLimiter,
  async (req, res, next) => {
    try {
      const { job_description, candidates } = req.body;

      if (!job_description) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'job_description is required',
        });
      }
      if (!Array.isArray(candidates) || candidates.length === 0) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'candidates must be a non-empty array',
        });
      }
      if (candidates.length > 50) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Maximum 50 candidates per request',
        });
      }

      const result = await matchCandidates({ job_description, candidates });
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/ai/feedback/:candidateId
// Auth: recruiter or superadmin (candidates may access their own via email check)
// ---------------------------------------------------------------------------
router.post(
  '/feedback/:candidateId',
  authenticateToken,
  aiRateLimiter,
  async (req, res, next) => {
    try {
      const { candidateId } = req.params;
      const userType = String(
        req.user?.userType || req.user?.role || ''
      ).toLowerCase();

      // Recruiters and superadmins have full access.
      // Candidates can only access their own feedback (identified by email in body).
      const isPrivileged = ['recruiter', 'superadmin'].includes(userType);
      const isOwnCandidate =
        userType === 'candidate' &&
        req.body?.candidateEmail &&
        String(req.body.candidateEmail).toLowerCase() ===
          String(req.user?.email || '').toLowerCase();

      if (!isPrivileged && !isOwnCandidate) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Access denied. Candidates may only view their own feedback.',
        });
      }

      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Evaluation data is required in the request body',
        });
      }

      const evaluationData = { ...req.body, candidateId };
      const result = await generateFeedback(evaluationData);

      return res.json({ success: true, candidateId, data: result });
    } catch (err) {
      return next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/ai/stats
// Auth: superadmin only
// ---------------------------------------------------------------------------
router.get(
  '/stats',
  authenticateToken,
  requireRole('superadmin'),
  (req, res, next) => {
    try {
      return res.json({
        success: true,
        modelStats: getTalentRouterModelStats(),
        costReport: getTalentRouterCostReport(),
        abTests: getTalentRouterABTestResults(),
      });
    } catch (err) {
      return next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/ai/costs
// Auth: superadmin only
// ---------------------------------------------------------------------------
router.get(
  '/costs',
  authenticateToken,
  requireRole('superadmin'),
  (req, res, next) => {
    try {
      return res.json({
        success: true,
        costReport: getTalentRouterCostReport(),
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
