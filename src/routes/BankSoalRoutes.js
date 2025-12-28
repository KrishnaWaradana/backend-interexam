const express = require('express');
const router = express.Router();
const controller = require('../controllers/BankSoalController');

// 1. Dashboard (Bisa ?as_role=admin atau ?as_role=validator)
router.get('/', controller.getBankSoal);

// 2. Detail Soal
router.get('/:id', controller.getSoalDetail);

// 3. Edit & Tambah ke Paket
router.put('/:id', controller.updateSoal);

// 4. Delete Soal
router.delete('/:id', controller.deleteSoal);

// 5. Dropdown Paket (Untuk Fitur Add to Packet)
router.get('/lookup/packets', controller.getLookupPackets);

module.exports = router;