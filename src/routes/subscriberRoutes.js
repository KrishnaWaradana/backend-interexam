const express = require("express");
const router = express.Router();
const subscriberController = require("../controllers/subscriberController");
const {
  authenticateToken,
  requireRole,
} = require("../middleware/authMiddleware");

// 1. GET BANK SOAL (untuk halaman Simpan - menampilkan soal yang bisa disimpan)
router.get(
  "/bank-soal",
  authenticateToken,
  requireRole(["subscriber"]),
  subscriberController.getSubscriberBankSoal,
);

// 2. GET FAVORIT SOAL (daftar soal yang sudah disimpan)
router.get(
  "/favorites",
  authenticateToken,
  requireRole(["subscriber"]),
  subscriberController.getSubscriberFavorites,
);

// 3. SAVE SOAL KE FAVORITES
router.post(
  "/favorites",
  authenticateToken,
  requireRole(["subscriber"]),
  subscriberController.saveToFavorites,
);

// 4. HAPUS SOAL DARI FAVORITES
router.delete(
  "/favorites/:id_soal",
  authenticateToken,
  requireRole(["subscriber"]),
  subscriberController.removeFromFavorites,
);

// 5. TOGGLE FAVORITE (SIMPAN/HAPUS)
router.post(
  "/favorites/toggle",
  authenticateToken,
  requireRole(["subscriber"]),
  subscriberController.toggleFavorite,
);

// 6. GET RECENT PAKETS (untuk dashboard home)
router.get(
  "/pakets/recent",
  authenticateToken,
  requireRole(["subscriber"]),
  subscriberController.getRecentPakets,
);

// 7. GET STATISTICS SUMMARY (untuk dashboard home)
router.get(
  "/statistics/summary",
  authenticateToken,
  requireRole(["subscriber"]),
  subscriberController.getStatisticsSummary,
);

// 8. GET STREAK & WEEKLY TARGET (untuk dashboard home)
router.get(
  "/statistics/streak",
  authenticateToken,
  requireRole(["subscriber"]),
  subscriberController.getStreakAndTarget,
);

// 9. GET ALL PAKETS WITH PROGRESS (untuk halaman course)
router.get(
  "/pakets",
  authenticateToken,
  requireRole(["subscriber"]),
  subscriberController.getAllPaketsWithProgress,
);

// 10. GET PAKET DETAIL BY ID
router.get(
  "/pakets/:id",
  authenticateToken,
  requireRole(["subscriber"]),
  subscriberController.getPaketDetailById,
);

module.exports = router;
