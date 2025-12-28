// apps/backend/src/routes/paketSoalRoutes.js

const express = require('express');
const router = express.Router();

// Import Controller
const paketSoalController = require('../controllers/paketSoalController');

// Import Middleware & Utils
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const uploadPaket = require('../utils/upload'); 

// ==========================================
// ROUTES KHUSUS PAKET SOAL
// ==========================================

// 1. GET BANK SOAL (Untuk Modal)
// URL Nanti: GET /api/admin/paket-soal/bank-soal
router.get('/bank-soal', 
    authenticateToken, 
    requireRole(['Admin', 'Validator']), 
    paketSoalController.getBankSoal
);

// 2. CREATE PAKET SOAL
// URL Nanti: POST /api/admin/paket-soal/
router.post('/', 
    authenticateToken, 
    requireRole(['Admin']), 
    uploadPaket.single('image'), // Sesuai field frontend
    paketSoalController.createPaketSoal
);

module.exports = router;