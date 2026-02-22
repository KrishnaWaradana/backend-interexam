const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
// Import middleware autentikasi kamu
const { authenticateToken } = require('../middleware/authMiddleware'); 

// Endpoint untuk mengambil data statistik (GET /api/dashboard/stats)
// Middleware authenticateToken memastikan req.user terisi
router.get('/stats', authenticateToken, getDashboardStats);

module.exports = router;