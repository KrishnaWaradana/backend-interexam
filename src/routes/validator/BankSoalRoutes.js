const express = require('express');
const router = express.Router();

// Pastikan path dan nama file benar (camelCase)
const controller = require('../../controllers/validator/BankSoalController');

// ⚠️ TESTING MODE: Auth dimatikan (Commented Out)
// const authMiddleware = require('../../middleware/authMiddleware');
// router.use(authMiddleware.verifyToken, authMiddleware.isValidator);

router.get('/', controller.getValidatorSoal);
router.get('/:id', controller.getSoalDetail);
router.put('/:id/validate', controller.validateSoal);

module.exports = router;