/**
 * api/routes/v1/upload.js
 * Resume upload endpoint with Multer
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Candidate = require('../../models/Candidate');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads/videos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration for resume uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename and add timestamp
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    cb(null, `${timestamp}_${sanitized}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow PDF, DOC, DOCX
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const allowedExt = ['.pdf', '.doc', '.docx'];
  const fileExt = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExt.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// ===== POST /api/resume/upload/:id =====
// Upload resume for existing candidate
router.post('/upload/:id', upload.single('resume'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Find candidate
    const candidate = await Candidate.findById(id);
    if (!candidate) {
      // Delete uploaded file if candidate not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Delete old resume if exists
    if (candidate.resumeUrl) {
      const oldPath = path.join(__dirname, '../../..', candidate.resumeUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Store relative path to uploaded file
    const resumeUrl = `/api/uploads/videos/${req.file.filename}`;

    // Update candidate with resume URL
    candidate.resumeUrl = resumeUrl;
    await candidate.save();

    res.status(200).json({
      success: true,
      message: 'Resume uploaded successfully',
      data: {
        candidateId: id,
        resumeUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size
      }
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Error uploading resume:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading resume',
      error: error.message
    });
  }
});

// Error handling for Multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds 5MB limit'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
});

module.exports = router;
