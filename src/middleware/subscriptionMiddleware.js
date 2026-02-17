const prisma = require("../config/prismaClient"); // Sesuaikan path prisma kamu

const requireActiveSubscription = async (req, res, next) => {
  try {
    // 1. Ambil ID Subscriber dari req.user (hasil dari authMiddleware)
    // Gunakan logika yang sama persis seperti di paymentController agar aman
    const id_subscriber =
      req.user.id_user || req.user.id || req.user.id_subscriber;

    if (!id_subscriber) {
      return res
        .status(401)
        .json({ message: "Identitas subscriber tidak ditemukan." });
    }

    // 2. Cek apakah user punya paket langganan yang AKTIF dan BELUM KADALUARSA
    const activeSubscription = await prisma.subscribePaket.findFirst({
      where: {
        id_subscriber: parseInt(id_subscriber),
        status: "active", // Pastikan statusnya active (sesuai Enum di schema)
        tanggal_selesai: {
          gte: new Date(), // Tanggal selesai harus Lebih Besar atau Sama Dengan (>=) Hari Ini
        },
      },
    });

    // 3. Logika Gembok
    if (!activeSubscription) {
      // Jika tidak punya paket aktif
      return res.status(403).json({
        message:
          "Fitur Terkunci. Silakan upgrade ke paket Premium untuk mengakses fitur ini.",
        code: "SUBSCRIPTION_REQUIRED", // Kode unik untuk Frontend (biar bisa nampilin popup bayar)
      });
    }

    // 4. Jika punya paket, simpan info paket di req agar bisa dipakai controller (opsional)
    req.subscription = activeSubscription;

    // 5. Silakan lewat
    next();
  } catch (error) {
    console.error("Subscription Check Error:", error);
    return res
      .status(500)
      .json({ message: "Gagal memverifikasi status langganan." });
  }
};

module.exports = { requireActiveSubscription };
