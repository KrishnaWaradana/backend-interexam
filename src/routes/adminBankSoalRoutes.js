const express = require('express');
const router = express.Router();

// Import Controller (Perhatikan path ".." karena sejajar folder)
const controller = require('../controllers/adminBankSoalController'); 
// const authMiddleware = require('../middleware/authMiddleware');

// router.use(authMiddleware.verifyToken, authMiddleware.isAdmin); 

router.get('/', controller.getAllSoal);
router.put('/:id/validate', controller.validateSoalAdmin);

module.exports = router;