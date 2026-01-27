const express = require("express");
const router = express.Router();
const subscriberController = require("../controllers/subscriberController");
const {
  authenticateToken,
  requireRole,
} = require("../middleware/authMiddleware");

// Middleware untuk subscriber - check role dari token
const isSubscriber = requireRole(["subscriber"]);

// 1. GET BANK SOAL (Halaman Simpan - menampilkan soal yang bisa disimpan)
router.get(
  "/bank-soal",
  authenticateToken,
  isSubscriber,
  subscriberController.getSubscriberBankSoal,
);

// 2. GET FAVORIT SOAL (Daftar soal yang sudah disimpan)
router.get(
  "/favorites",
  authenticateToken,
  isSubscriber,
  subscriberController.getSubscriberFavorites,
);

// 3. SAVE SOAL KE FAVORITES
router.post(
  "/favorites",
  authenticateToken,
  isSubscriber,
  subscriberController.saveToFavorites,
);

// 4. HAPUS SOAL DARI FAVORITES
router.delete(
  "/favorites/:id_soal",
  authenticateToken,
  isSubscriber,
  subscriberController.removeFromFavorites,
);

// 5. TOGGLE FAVORITE (SIMPAN/HAPUS)
router.post(
  "/favorites/toggle",
  authenticateToken,
  isSubscriber,
  subscriberController.toggleFavorite,
);

// 6. GET RECENT PAKETS (Dashboard Home - 4 paket terbaru)
router.get(
  "/pakets/recent",
  authenticateToken,
  isSubscriber,
  subscriberController.getRecentPakets,
);

// 7. GET STATISTICS SUMMARY (Dashboard Home - skor, total ujian, waktu)
router.get(
  "/statistics/summary",
  authenticateToken,
  isSubscriber,
  subscriberController.getStatisticsSummary,
);

// 8. GET STREAK & WEEKLY TARGET (Dashboard Home)
router.get(
  "/statistics/streak",
  authenticateToken,
  isSubscriber,
  subscriberController.getStreakAndTarget,
);

// 9. GET ALL PAKETS WITH PROGRESS (Halaman Course/Latihan)
router.get(
  "/pakets",
  authenticateToken,
  isSubscriber,
  subscriberController.getAllPaketsWithProgress,
);

// 10. GET PAKET DETAIL BY ID (Halaman DetailExam & ExamAttempt)
router.get(
  "/pakets/:id",
  authenticateToken,
  isSubscriber,
  subscriberController.getPaketDetailById,
);

// --- RUTE BARU UNTUK PROGRES & SUBMIT ---

// 11. SAVE PROGRESS (Simpan jawaban sementara saat user 'Kembali' atau pindah soal)
router.post(
  "/pakets/save-progress",
  authenticateToken,
  isSubscriber,
  subscriberController.saveExamProgress,
);

// 12. SUBMIT EXAM (Finalisasi pengerjaan, kunci finished_at, dan hitung skor akhir)
router.post(
  "/pakets/submit",
  authenticateToken,
  isSubscriber,
  subscriberController.submitExam,
);

module.exports = router;
