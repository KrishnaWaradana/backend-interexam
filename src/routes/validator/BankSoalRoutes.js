const express = require('express');
const router = express.Router();

// Import Controller (Perhatikan path "../.." untuk keluar dari folder validator & routes)
const controller = require('../../controllers/validator/BankSoalController');
// const authMiddleware = require('../../middleware/authMiddleware');

// router.use(authMiddleware.verifyToken, authMiddleware.isValidator);

router.get('/', controller.getValidatorSoal);
router.get('/:id', controller.getSoalDetail);
router.put('/:id/validate', controller.validateSoal);

module.exports = router;