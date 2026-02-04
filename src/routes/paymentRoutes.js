const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');


router.post('/payment/charge', authenticateToken, paymentController.createTransaction);
router.post('/payment/notification', notificationController.handleNotification);

module.exports = router;