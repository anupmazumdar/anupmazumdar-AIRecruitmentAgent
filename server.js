/**
 * server.js
 * Production-ready Express server for TalentAI Recruitment Platform
 * Runs on Railway with MongoDB backend
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import middleware
const { globalErrorHandler } = require('./api/middleware/errorHandler');
const { morganMiddleware } = require('./api/middleware/logger');

// Import routes
const candidateRoutes = require('./api/routes/v1/candidates');
const evaluationRoutes = require('./api/routes/v1/evaluations');
const uploadRoutes = require('./api/routes/v1/upload');
const healthRoutes = require('./api/routes/v1/health');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// ===== DATABASE CONNECTION =====
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not set in environment variables');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      retryWrites: true,
      w: 'majority'
    });

    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

// ===== MIDDLEWARE =====

// Trust proxy - needed for Railway/Vercel
app.set('trust proxy', 1);

// Logging
app.use(morganMiddleware);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// CORS Configuration
const corsOptions = {
  origin: [
    'https://anupmazumdar-ai-recruitment-agent.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// ===== API ROUTES =====
app.use('/api/candidates', candidateRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/resume', uploadRoutes);
app.use('/api/health', healthRoutes);

// ===== SERVE REACT BUILD =====
const buildPath = path.join(__dirname, 'frontend', 'build');
const publicPath = path.join(__dirname, 'frontend', 'public');

// Static files from React build
app.use(express.static(buildPath));

// Fallback to index.html for React SPA routing
app.get('/', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Any other route not matching an API endpoint - serve React app
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(buildPath, 'index.html'), (err) => {
      if (err) {
        res.status(404).json({ error: 'Not found' });
      }
    });
  }
});

// ===== ERROR HANDLING =====
app.use(globalErrorHandler);

// ===== 404 Handler =====
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// ===== START SERVER =====
const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();

    // Listen on 0.0.0.0 to be accessible from Railway
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`📱 Frontend: https://anupmazumdar-ai-recruitment-agent.vercel.app`);
      console.log(`🗄️  Database: MongoDB connected`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  mongoose.connection.close();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
