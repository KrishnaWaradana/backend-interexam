// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const { authenticateToken } = require('../middleware/authMiddleware');
// Endpoint: POST /api/auth/google
router.post('/google', authController.googleLogin);
router.get('/me', authenticateToken, authController.getMe);
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;