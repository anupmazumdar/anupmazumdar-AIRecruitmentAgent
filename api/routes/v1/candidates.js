/**
 * api/routes/v1/candidates.js
 * REST API endpoints for candidate management
 */

const express = require('express');
const router = express.Router();
const Candidate = require('../../models/Candidate');
const Evaluation = require('../../models/Evaluation');
const fs = require('fs');
const path = require('path');

// ===== POST /api/candidates =====
// Create a new candidate (optional resume upload handled separately)
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, jobRole, metadata } = req.body;

    if (!name || !email || !jobRole) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, email, jobRole'
      });
    }

    // Check if candidate already exists
    const existing = await Candidate.findOne({ email });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Candidate with this email already exists'
      });
    }

    const candidate = new Candidate({
      name,
      email,
      phone: phone || '',
      jobRole,
      metadata: metadata || {}
    });

    await candidate.save();

    res.status(201).json({
      success: true,
      message: 'Candidate created successfully',
      data: candidate
    });
  } catch (error) {
    console.error('Error creating candidate:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating candidate',
      error: error.message
    });
  }
});

// ===== GET /api/candidates =====
// List all candidates with filters and pagination
router.get('/', async (req, res) => {
  try {
    const { status, jobRole, page = 1, limit = 20, sort = '-createdAt' } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (jobRole) filter.jobRole = jobRole;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const candidates = await Candidate.find(filter)
      .populate('evaluations')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .exec();

    const total = await Candidate.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: candidates,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching candidates',
      error: error.message
    });
  }
});

// ===== GET /api/candidates/:id =====
// Get single candidate with evaluations
router.get('/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id).populate('evaluations');

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    res.status(200).json({
      success: true,
      data: candidate
    });
  } catch (error) {
    console.error('Error fetching candidate:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching candidate',
      error: error.message
    });
  }
});

// ===== PATCH /api/candidates/:id =====
// Update candidate status and details
router.patch('/:id', async (req, res) => {
  try {
    const { status, notes, metadata, name, phone } = req.body;
    const updateData = {};

    if (status) updateData.status = status;
    if (notes) updateData['metadata.notes'] = notes;
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (metadata) updateData.metadata = { ...metadata };

    const candidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Candidate updated successfully',
      data: candidate
    });
  } catch (error) {
    console.error('Error updating candidate:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating candidate',
      error: error.message
    });
  }
});

// ===== DELETE /api/candidates/:id =====
// Delete candidate, resume file, and evaluations
router.delete('/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Delete resume file if exists
    if (candidate.resumeUrl) {
      const filePath = path.join(__dirname, '../../..', candidate.resumeUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete all evaluations for this candidate
    await Evaluation.deleteMany({ candidateId: req.params.id });

    // Delete candidate
    await Candidate.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Candidate and associated data deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting candidate',
      error: error.message
    });
  }
});

module.exports = router;
