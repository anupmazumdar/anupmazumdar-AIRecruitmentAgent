/**
 * api/models/Candidate.js
 * Candidate schema for TalentAI recruitment platform
 */

const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Candidate name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
      lowercase: true,
      unique: true,
      sparse: true
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[0-9]{10,15}$/, 'Please provide a valid phone number']
    },
    jobRole: {
      type: String,
      required: [true, 'Job role is required'],
      trim: true
    },
    resumeUrl: {
      type: String,
      default: null
    },
    resumeText: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['applied', 'screening', 'interview', 'selected', 'rejected'],
      default: 'applied'
    },
    evaluations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Evaluation'
      }
    ],
    metadata: {
      source: String,
      appliedAt: Date,
      notes: String
    }
  },
  {
    timestamps: true,
    collection: 'candidates'
  }
);

// Index for common queries
candidateSchema.index({ email: 1, jobRole: 1 });
candidateSchema.index({ status: 1 });
candidateSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Candidate', candidateSchema);
