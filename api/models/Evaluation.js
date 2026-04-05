/**
 * api/models/Evaluation.js
 * Evaluation schema for TalentAI AI model results
 */

const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: [true, 'Candidate ID is required'],
      index: true
    },
    taskMode: {
      type: String,
      enum: [
        'RESUME_PARSING',
        'CANDIDATE_SCORING',
        'INTERVIEW_EVAL',
        'QUIZ_GRADING',
        'FEEDBACK_GENERATION',
        'BIAS_DETECTION',
        'JD_MATCHING'
      ],
      required: true
    },
    modelUsed: {
      type: String,
      required: [true, 'Model name is required'],
      example: 'gpt-4o'
    },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 1,
      default: null
    },
    latencyMs: {
      type: Number,
      default: null
    },
    estimatedCost: {
      type: Number,
      default: 0
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    rawText: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    error: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'evaluations'
  }
);

// Index for common queries
evaluationSchema.index({ candidateId: 1, taskMode: 1 });
evaluationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Evaluation', evaluationSchema);
