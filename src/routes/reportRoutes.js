const express = require('express');
const router = express.Router();
const { getReportData } = require('../controllers/reportController'); // Pastikan controller sudah dibuat
const { authenticateToken } = require('../middleware/authMiddleware');

// --- 1. VERSI UJI CUBA (Bypass ID 13) ---
// Gunakan ini untuk tes di user_test.http tanpa login
// const bypassAuth = (req, res, next) => {
//     req.user = { id_user: 13, role: 'Admin' }; 
//     next();
// };
// router.get('/stats', bypassAuth, getReportData);


// --- 2. VERSI RESMI (Untuk Frontend) ---
// Hapus komentar di bawah ini dan hapus route bypass di atas jika sudah siap produksi
router.get('/stats', authenticateToken, getReportData);

module.exports = router;