const express = require('express');
const router = express.Router();
const paketSoalController = require('../controllers/paketSoalController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const uploadPaket = require('../utils/upload'); 

// Middleware wrapper untuk menangani upload gambar tanpa crash 500
const handleUpload = (req, res, next) => {
  uploadPaket.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          status: 'error',
          message: 'Ukuran file gambar terlalu besar. Maksimal 10MB.' 
        });
      }
      return res.status(400).json({ 
        status: 'error',
        message: err.message || 'Gagal mengunggah file gambar.' 
      });
    }
    next();
  });
};

// 1. GET ALL
router.get('/', authenticateToken, paketSoalController.getAllPaket);

// 2. GET BANK SOAL (HARUS DI ATAS /:id)
router.get('/bank-soal', authenticateToken, requireRole(['Admin', 'Validator']), paketSoalController.getBankSoal);

// 3. GET DETAIL (Pastikan ini ada!)
router.get('/:id', authenticateToken, paketSoalController.getPaketDetail);

// 4. CREATE
router.post('/', authenticateToken, requireRole(['Admin', 'Validator']), handleUpload, paketSoalController.createPaketSoal);

// 5. UPDATE (Pastikan ini ada!)
router.put('/:id', authenticateToken, requireRole(['Admin', 'Validator']), handleUpload, paketSoalController.updatePaket);

// 6. DELETE
router.delete('/:id', authenticateToken, requireRole(['Admin', 'Validator']), paketSoalController.deletePaket);

module.exports = router;