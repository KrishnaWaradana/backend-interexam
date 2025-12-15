const express = require('express');
const router = express.Router();
const jenjangController = require('../controllers/jenjangController');



// 1. Create (POST /)
router.post('/', jenjangController.createJenjang);

// 2. Read All (GET /)
router.get('/', jenjangController.getAllJenjang);

// 3. Update (PUT /:id)
router.put('/:id', jenjangController.updateJenjang);

// 4. Delete (DELETE /:id)
router.delete('/:id', jenjangController.deleteJenjang);

module.exports = router;