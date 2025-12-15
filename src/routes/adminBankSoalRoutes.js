const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminBankSoalController');

// ⚠️ TESTING MODE: Auth dimatikan
// const authMiddleware = require('../middleware/authMiddleware');
// router.use(authMiddleware.verifyToken, authMiddleware.isAdmin); 

router.get('/', controller.getAllSoal);
router.put('/:id/validate', controller.validateSoalAdmin);

module.exports = router;