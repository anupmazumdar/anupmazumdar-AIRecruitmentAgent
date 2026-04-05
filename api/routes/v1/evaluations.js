/**
 * api/routes/v1/evaluations.js
 * REST API endpoints for evaluation management
 */

const express = require('express');
const router = express.Router();
const Evaluation = require('../../models/Evaluation');
const Candidate = require('../../models/Candidate');

// ===== POST /api/evaluations =====
// Save AI evaluation result
router.post('/', async (req, res) => {
  try {
    const {
      candidateId,
      taskMode,
      modelUsed,
      confidenceScore,
      latencyMs,
      estimatedCost,
      result,
      rawText,
      status = 'completed'
    } = req.body;

    if (!candidateId || !taskMode || !modelUsed) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: candidateId, taskMode, modelUsed'
      });
    }

    // Verify candidate exists
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    const evaluation = new Evaluation({
      candidateId,
      taskMode,
      modelUsed,
      confidenceScore: confidenceScore || null,
      latencyMs: latencyMs || null,
      estimatedCost: estimatedCost || 0,
      result: result || null,
      rawText: rawText || null,
      status
    });

    await evaluation.save();

    // Add evaluation to candidate's evaluations array
    candidate.evaluations.push(evaluation._id);
    await candidate.save();

    res.status(201).json({
      success: true,
      message: 'Evaluation saved successfully',
      data: evaluation
    });
  } catch (error) {
    console.error('Error saving evaluation:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving evaluation',
      error: error.message
    });
  }
});

// ===== GET /api/evaluations/:candidateId =====
// Get all evaluations for a candidate
router.get('/:candidateId', async (req, res) => {
  try {
    const evaluations = await Evaluation.find({
      candidateId: req.params.candidateId
    }).sort('-createdAt');

    if (!evaluations || evaluations.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'No evaluations found for this candidate'
      });
    }

    res.status(200).json({
      success: true,
      data: evaluations,
      count: evaluations.length
    });
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching evaluations',
      error: error.message
    });
  }
});

module.exports = router;
