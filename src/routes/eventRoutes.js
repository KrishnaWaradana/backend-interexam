const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const upload = require('../middleware/uploadMiddleware');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

// === ADMIN & VALIDATOR ROUTES ===

// 1. GET ALL (List Data)
router.get('/', 
    authenticateToken, 
    authorizeRole(['Admin', 'Validator']), 
    eventController.getAllEvents
);

// 2. GET BY ID (Detail Edit)
router.get('/:id', 
    authenticateToken, 
    authorizeRole(['Admin', 'Validator']), 
    eventController.getEventById
);

// 3. CREATE (Add)
router.post('/', 
    authenticateToken, 
    authorizeRole(['Admin', 'Validator']), 
    upload.single('fotoEvent'), 
    eventController.addEvent
);

// 4. UPDATE (Edit)
router.put('/:id', 
    authenticateToken, 
    authorizeRole(['Admin', 'Validator']), 
    upload.single('fotoEvent'), 
    eventController.updateEvent
);

// 5. DELETE (Hapus)
router.delete('/:id', 
    authenticateToken, 
    authorizeRole(['Admin', 'Validator']), 
    eventController.deleteEvent
);

// 6. LOOKUP (Modal Paket)
router.get('/packages-lookup', 
    authenticateToken, 
    authorizeRole(['Admin', 'Validator', 'Contributor']), 
    eventController.getPackagesLookup
);

module.exports = router;