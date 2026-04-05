/**
 * api/routes/v1/health.js
 * Health check endpoints
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// ===== GET /api/health =====
// Basic health check
router.get('/', (req, res) => {
  const health = {
    status: 'UP',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED',
    uptime: process.uptime()
  };

  res.status(200).json(health);
});

module.exports = router;
