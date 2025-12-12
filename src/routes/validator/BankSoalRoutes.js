const express = require('express');
const router = express.Router();
const controller = require('../../controllers/validator/BankSoalController');

// Auth 
// const authMiddleware = require('../../middleware/authMiddleware');
// router.use(authMiddleware.verifyToken, authMiddleware.isValidator);

router.get('/', controller.getValidatorSoal);
router.get('/:id', controller.getSoalDetail);
router.put('/:id/validate', controller.validateSoal);

module.exports = router;