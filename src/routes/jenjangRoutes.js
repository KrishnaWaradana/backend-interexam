const express = require('express');
const router = express.Router();
const jenjangController = require('../controllers/jenjangController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');



// 1. Create (POST /)
router.post('/',authenticateToken,  jenjangController.createJenjang);

// 2. Read All (GET /)
router.get('/',authenticateToken,  jenjangController.getAllJenjang);

// 3. Update (PUT /:id)
router.put('/:id',authenticateToken,  jenjangController.updateJenjang);

// 4. Delete (DELETE /:id)
router.delete('/:id',authenticateToken,  jenjangController.deleteJenjang);

module.exports = router;