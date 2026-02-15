const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const upload = require('../middleware/upload');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// === ADMIN & VALIDATOR ROUTES ===

// 1. LOOKUP (Modal Paket) 
router.get('/packages-lookup', 
    authenticateToken, 
    requireRole(['Admin', 'Validator', 'Contributor']),
    eventController.getPackagesLookup
);

// 2. GET ALL (List Data)
router.get('/', 
    authenticateToken, 
    requireRole(['Admin', 'Validator']),
    eventController.getAllEvents
);

// 3. GET BY ID (Detail Edit)
router.get('/:id', 
    authenticateToken, 
    requireRole(['Admin', 'Validator']), 
    eventController.getEventById
);

// 4. CREATE (Add)
router.post('/', 
    authenticateToken, 
    requireRole(['Admin', 'Validator']),
    upload.single('fotoEvent'),
    eventController.addEvent
);

// 5. UPDATE (Edit)
router.put('/:id', 
    authenticateToken, 
    requireRole(['Admin', 'Validator']),
    upload.single('fotoEvent'), 
    eventController.updateEvent
);

// 6. DELETE (Hapus)
router.delete('/:id', 
    authenticateToken, 
    requireRole(['Admin', 'Validator']),
    eventController.deleteEvent
);

module.exports = router;