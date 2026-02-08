const midtransClient = require("midtrans-client");
const prisma = require("../config/prismaClient");

// Inisialisasi Midtrans Snap
const snap = new midtransClient.Snap({
  isProduction: false, // Ubah ke true nanti jika sudah live production
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

const apiClient = new midtransClient.CoreApi({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

// ==========================================
// FUNGSI UTAMA: BUAT TRANSAKSI (GET TOKEN)
// ==========================================
exports.createTransaction = async (req, res) => {
  const id_subscriber_token =
    req.user.id_user || req.user.id || req.user.id_subscriber;

  const { id_paket_langganan } = req.body;

  try {
    const user = await prisma.subscribers.findUnique({
      where: { id_subscriber: parseInt(id_subscriber_token) },
    });

    if (!user)
      return res.status(404).json({ message: "Subscriber tidak ditemukan" });

    // Cek Paket Langganan
    const paket = await prisma.paketLangganan.findUnique({
      where: { id_paket_langganan: parseInt(id_paket_langganan) },
      include: { diskonPaket: true },
    });

    if (!paket)
      return res.status(404).json({ message: "Paket tidak ditemukan" });

    // --- LOGIKA HITUNG HARGA
    let grossAmount = paket.harga;
    const today = new Date();

    if (paket.diskonPaket && paket.diskonPaket.length > 0) {
      const diskonInfo = paket.diskonPaket[0];
      const startDate = new Date(diskonInfo.tanggal_mulai_diskon);
      const endDate = new Date(diskonInfo.tanggal_selesai_diskon);

      if (today >= startDate && today <= endDate) {
        const diskonNominal = (paket.harga * diskonInfo.diskon) / 100;
        grossAmount = paket.harga - diskonNominal;
      }
    }

    const transaksiBaru = await prisma.transaksi.create({
      data: {
        id_paket_langganan: paket.id_paket_langganan,
        id_subscriber: user.id_subscriber, // Sudah benar pakai user.id_subscriber
        amount: parseInt(grossAmount),
        status: "pending",
      },
    });

    const parameter = {
      transaction_details: {
        order_id: transaksiBaru.id_transaksi,
        gross_amount: parseInt(grossAmount),
      },
      customer_details: {
        // FIX 3: Pastikan ambil field yang benar dari tabel subscriber
        first_name: user.nama_subscriber, // Ganti nama_user jadi nama_subscriber
        email: user.email_subscriber, // Ganti email_user jadi email_subscriber
        phone: user.phone || "",
      },
      item_details: [
        {
          id: `PKT-${paket.id_paket_langganan}`,
          price: parseInt(grossAmount),
          quantity: 1,
          name: paket.nama_paket.substring(0, 50),
        },
      ],
    };

    const transactionToken = await snap.createTransaction(parameter);

    await prisma.transaksi.update({
      where: { id_transaksi: transaksiBaru.id_transaksi },
      data: { snap_token: transactionToken.token },
    });

    res.status(200).json({
      message: "Token transaksi berhasil dibuat",
      token: transactionToken.token,
      redirect_url: transactionToken.redirect_url,
      order_id: transaksiBaru.id_transaksi,
    });
  } catch (error) {
    console.error("Midtrans Error:", error);
    res
      .status(500)
      .json({ message: "Gagal memproses transaksi", error: error.message });
  }
};

exports.checkMidtransConnection = async (req, res) => {
  try {
    const parameter = {
      transaction_details: {
        order_id: `TEST-KONEKSI-${Date.now()}`,
        gross_amount: 10000,
      },
      credit_card: { secure: true },
    };

    // GANTI 'apiClient' MENJADI 'snap'
    // Karena .createTransaction() adalah miliknya Snap
    const transaction = await snap.createTransaction(parameter);

    res.status(200).json({
      message: "✅ KONEKSI MIDTRANS BERHASIL!",
      midtrans_response: transaction,
    });
  } catch (error) {
    console.error("Midtrans Error:", error.message);
    res.status(500).json({
      message: "❌ KONEKSI GAGAL.",
      error: error.message,
    });
  }
};
