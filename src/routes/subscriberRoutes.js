const express = require("express");
const router = express.Router();

// Controllers
const dashboardController = require("../controllers/subscriber/dashboardController");
const examController = require("../controllers/subscriber/examController");
const libraryController = require("../controllers/subscriber/libraryController");

// Middleware
const {
  authenticateToken,
  requireRole,
} = require("../middleware/authMiddleware");
const {
  requireActiveSubscription,
} = require("../middleware/subscriptionMiddleware");

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
  requireActiveSubscription,
  libraryController.getSubscriberFavorites,
);

// 3. SAVE SOAL KE FAVORITES
router.post(
  "/favorites",
  authenticateToken,
  isSubscriber,
  requireActiveSubscription,
  libraryController.saveToFavorites,
);

// 4. HAPUS SOAL DARI FAVORITES
router.delete(
  "/favorites/:id",
  authenticateToken,
  isSubscriber,
  requireActiveSubscription,
  libraryController.removeFromFavorites,
);

// 5. TOGGLE FAVORITE (SIMPAN/HAPUS)
router.post(
  "/favorites/toggle",
  authenticateToken,
  isSubscriber,
  requireActiveSubscription,
  libraryController.toggleFavorite,
);

// --- MANAJEMEN FOLDER (BARU) ---

// 6. BUAT FOLDER BARU
router.post(
  "/folders",
  authenticateToken,
  isSubscriber,
  requireActiveSubscription,
  libraryController.createFolder,
);

// 7. LIHAT DAFTAR FOLDER SAYA
router.get(
  "/folders",
  authenticateToken,
  isSubscriber,
  requireActiveSubscription,
  libraryController.getMyFolders,
);

// 8. HAPUS FOLDER
router.delete(
  "/folders/:id",
  authenticateToken,
  isSubscriber,
  requireActiveSubscription,
  libraryController.deleteFolder,
);

// 9. PINDAHKAN FAVORIT KE FOLDER
router.post(
  "/folders/add-item",
  authenticateToken,
  isSubscriber,
  requireActiveSubscription,
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
  requireActiveSubscription,
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

// Endpoint pengecekan status paket langganan pada subscriber
router.get(
  "/check-status",
  authenticateToken,
  isSubscriber,
  async (req, res) => {
    try {
      const id_subscriber = req.user.id_user || req.user.id;

      // Cek subscription aktif
      const activeSub = await prisma.subscribePaket.findFirst({
        where: {
          id_subscriber: parseInt(id_subscriber),
          status: "active",
          tanggal_selesai: { gte: new Date() },
        },
      });

      res.json({
        status: "success",
        is_premium: !!activeSub, // true jika ada, false jika null
      });
    } catch (error) {
      res.status(500).json({ is_premium: false });
    }
  },
);

module.exports = router;
