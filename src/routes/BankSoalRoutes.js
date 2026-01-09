const express = require('express');
const router = express.Router();
const controller = require('../controllers/BankSoalController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
// 1. Dashboard (Bisa ?as_role=admin atau ?as_role=validator)
router.get('/',authenticateToken, controller.getBankSoal);

// 2. Detail Soal
router.get('/:id',authenticateToken, controller.getSoalDetail);

// 3. Edit & Tambah ke Paket
router.put('/:id',authenticateToken, controller.updateSoal);

// 4. Delete Soal
router.delete('/:id',authenticateToken, controller.deleteSoal);

// 5. Dropdown Paket (Untuk Fitur Add to Packet)
router.get('/lookup/packets',authenticateToken,  controller.getLookupPackets);

module.exports = router;