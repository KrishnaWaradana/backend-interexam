const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { authenticateToken } = require("../middleware/authMiddleware");
const notificationController = require("../controllers/notificationController");

// --- PERUBAHAN DI SINI ---
// Tambahkan requireRole("subscriber") di tengah-tengah
router.post("/charge", authenticateToken, paymentController.createTransaction);

router.post("/notification", notificationController.handleNotification);
router.get("/test-connection", paymentController.checkMidtransConnection);

module.exports = router;
