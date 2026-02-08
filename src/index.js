const path = require("path");
const express = require("express");
const cors = require("cors");
const app = express();
const dotenv = require("dotenv");

dotenv.config();

global.__basedir = __dirname;

// --- IMPORTS ROUTES ---
const prisma = require("./config/prismaClient");
const contributorLookupRoutes = require("./routes/contributor/lookupRoutes");
const adminRoutes = require("./routes/adminRoutes");
const topicRoutes = require("./routes/topicRoutes");
const authRoutes = require("./routes/authRoutes");
const jenjangRoutes = require("./routes/jenjangRoutes");
const paketSoalRoutes = require("./routes/paketSoalRoutes");
const soalRoutes = require("./routes/contributor/soalRoutes");
const bankSoalRoutes = require("./routes/BankSoalRoutes");
const subTopicRoutes = require("./routes/subTopikRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const subscriberRoutes = require("./routes/subscriberRoutes");
const landingRoutes = require("./routes/landingRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

// ==========================================
// 1. MIDDLEWARE GLOBAL & KEAMANAN
// ==========================================

// A. Log Request (Supaya kamu tahu kalau ada request masuk)
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
  next();
});

// B. Parsing Body (JSON & Form)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// C. CORS (Izin Frontend mengakses Backend)
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  }),
);

// D. FIX CSP ERROR (Untuk Midtrans & Google)
// Middleware ini memaksa browser mengizinkan script Midtrans (snap) berjalan
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
  );
  next();
});

// E. Folder Uploads Static
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ==========================================
// 2. ROUTING (DAFTAR ALAMAT API)
// ==========================================

// Route Admin (Prefix: /api/v1)
// Pastikan di dalam adminRoutes tidak ada path ganda
app.use("/api/v1/", adminRoutes);

// Topic & Subtopic
app.use("/api/v1/topics", topicRoutes);
app.use("/api/v1/subtopics", subTopicRoutes);

// Auth (Login/Register/Google)
app.use("/api/auth", authRoutes);

// Admin Khusus
app.use("/api/v1/admin/paket-soal", paketSoalRoutes);
app.use("/api/v1/admin/jenjang", jenjangRoutes);

// Categories
app.use("/api/v1/categories", categoryRoutes);

// Bank Soal (Admin & Validator)
app.use("/api/v1/bank-soal", bankSoalRoutes);

// Subscriber (User Panel)
app.use("/api/v1/subscriber", subscriberRoutes);

// Landing Page (Public)
app.use("/api/v1/landing", landingRoutes);

// Contributor Routes
app.use("/api/v1/contributor/lookup", contributorLookupRoutes);
app.use("/api/v1/contributor", soalRoutes);

// --- ROUTE PAYMENT (YANG TADI ERROR) ---
// Jika di file paymentRoutes.js isinya: router.post('/payment/charge', ...)
// Maka URL-nya jadi: /api/v1/payment/charge
app.use("/api/v1/payment", paymentRoutes);

// ==========================================
// 3. ERROR HANDLING (PENANGKAP ERROR)
// ==========================================

// A. Handle 404 (Route Tidak Ditemukan)
app.use((req, res, next) => {
  console.log(`[404] Route not found: ${req.originalUrl}`);
  res.status(404).json({
    status: "error",
    message: `Endpoint ${req.originalUrl} tidak ditemukan di server ini.`,
  });
});

// B. Handle 500 (Server Error / Codingan Error)
app.use((err, req, res, next) => {
  console.error("[SERVER ERROR]:", err.stack); // Tampilkan error detail di terminal
  res.status(500).json({
    status: "error",
    message: "Terjadi kesalahan internal pada server.",
    error: err.message, // Kirim pesan error ke frontend (bisa dihapus saat production)
  });
});

// ==========================================
// 4. JALANKAN SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server Express berjalan di http://localhost:${PORT}`);
});
