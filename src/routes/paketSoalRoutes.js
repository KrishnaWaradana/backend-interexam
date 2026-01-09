const express = require('express');
const router = express.Router();
const paketSoalController = require('../controllers/paketSoalController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const uploadPaket = require('../utils/upload'); 

// 1. GET ALL
router.get('/', authenticateToken, paketSoalController.getAllPaket);

// 2. GET BANK SOAL (HARUS DI ATAS /:id)
router.get('/bank-soal', authenticateToken, requireRole(['Admin', 'Validator']), paketSoalController.getBankSoal);

// 3. GET DETAIL (Pastikan ini ada!)
router.get('/:id', authenticateToken, paketSoalController.getPaketDetail);

// 4. CREATE
router.post('/', authenticateToken, requireRole(['Admin']), uploadPaket.single('image'), paketSoalController.createPaketSoal);

// 5. UPDATE (Pastikan ini ada!)
router.put('/:id', authenticateToken, requireRole(['Admin']), uploadPaket.single('image'), paketSoalController.updatePaket);

// 6. DELETE
router.delete('/:id', authenticateToken, requireRole(['Admin']), paketSoalController.deletePaket);

module.exports = router;