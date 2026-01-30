const express = require("express");
const router = express.Router();

const dashboardController = require("../controllers/subscriber/dashboardController");
const examController = require("../controllers/subscriber/examController");
const libraryController = require("../controllers/subscriber/libraryController");

const {
  authenticateToken,
  requireRole,
} = require("../middleware/authMiddleware");

// check role dari token
const isSubscriber = requireRole(["subscriber"]);

// ==========================================
// GROUP 1: LIBRARY & FAVORITES (libraryController)
// ==========================================

// --- BANK SOAL & FAVORIT ---

// 1. GET BANK SOAL (Halaman Simpan - menampilkan soal yang bisa disimpan)
router.get(
  "/bank-soal",
  authenticateToken,
  isSubscriber,
  libraryController.getSubscriberBankSoal,
);

// 2. GET FAVORIT SOAL (Daftar soal yang sudah disimpan)
router.get(
  "/favorites",
  authenticateToken,
  isSubscriber,
  libraryController.getSubscriberFavorites,
);

// 3. SAVE SOAL KE FAVORITES
router.post(
  "/favorites",
  authenticateToken,
  isSubscriber,
  libraryController.saveToFavorites,
);

// 4. HAPUS SOAL DARI FAVORITES
router.delete(
  "/favorites/:id",
  authenticateToken,
  isSubscriber,
  libraryController.removeFromFavorites,
);

// 5. TOGGLE FAVORITE (SIMPAN/HAPUS)
router.post(
  "/favorites/toggle",
  authenticateToken,
  isSubscriber,
  libraryController.toggleFavorite,
);

// --- MANAJEMEN FOLDER (BARU) ---

// 6. BUAT FOLDER BARU
router.post(
  "/folders",
  authenticateToken,
  isSubscriber,
  libraryController.createFolder,
);

// 7. LIHAT DAFTAR FOLDER SAYA
router.get(
  "/folders",
  authenticateToken,
  isSubscriber,
  libraryController.getMyFolders,
);

// 8. HAPUS FOLDER
router.delete(
  "/folders/:id",
  authenticateToken,
  isSubscriber,
  libraryController.deleteFolder,
);

// 9. PINDAHKAN FAVORIT KE FOLDER
router.post(
  "/folders/add-item",
  authenticateToken,
  isSubscriber,
  libraryController.addToFolder,
);

// --- PAKET SOAL ---

// 10. GET ALL PAKETS WITH PROGRESS (Halaman Course/Latihan)
router.get(
  "/pakets",
  authenticateToken,
  isSubscriber,
  libraryController.getAllPaketsWithProgress,
);

// ==========================================
// GROUP 2: DASHBOARD & STATS (dashboardController)
// ==========================================

// 11. GET RECENT PAKETS (Dashboard Home - 4 paket terbaru)
router.get(
  "/pakets/recent",
  authenticateToken,
  isSubscriber,
  dashboardController.getRecentPakets,
);

// 12. GET STATISTICS SUMMARY (Dashboard Home - skor, total ujian, waktu)
router.get(
  "/statistics/summary",
  authenticateToken,
  isSubscriber,
  dashboardController.getStatisticsSummary,
);

// 13. GET STREAK & WEEKLY TARGET (Dashboard Home)
router.get(
  "/statistics/streak",
  authenticateToken,
  isSubscriber,
  dashboardController.getStreakAndTarget,
);

// 14. GET PROGRESS ANALYTICS (Halaman Perkembangan - Grafik)
router.get(
  "/statistics/progress",
  authenticateToken,
  isSubscriber,
  dashboardController.getProgressAnalytics,
);

// ==========================================
// GROUP 3: EXAM & ATTEMPTS (examController)
// ==========================================

// 15. GET PAKET DETAIL BY ID (Halaman DetailExam & ExamAttempt)
router.get(
  "/pakets/:id",
  authenticateToken,
  isSubscriber,
  examController.getPaketDetailById,
);

// 16. SAVE PROGRESS (Simpan jawaban sementara)
router.post(
  "/pakets/save-progress",
  authenticateToken,
  isSubscriber,
  examController.saveExamProgress,
);

// 17. SUBMIT EXAM (Finalisasi pengerjaan)
router.post(
  "/pakets/submit",
  authenticateToken,
  isSubscriber,
  examController.submitExam,
);

// 18. GET LEADERBOARD (Ranking per paket)
router.get(
  "/pakets/:id/leaderboard",
  authenticateToken,
  isSubscriber,
  examController.getExamLeaderboard,
);

module.exports = router;
