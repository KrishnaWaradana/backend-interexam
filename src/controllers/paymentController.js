const midtransClient = require('midtrans-client');
const prisma = require('../config/prismaClient');

// Inisialisasi Midtrans Snap
const snap = new midtransClient.Snap({
    isProduction: false, // Ubah ke true nanti jika sudah live production
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// ==========================================
// FUNGSI UTAMA: BUAT TRANSAKSI (GET TOKEN)
// ==========================================
exports.createTransaction = async (req, res) => {
    // const id_user = req.user.id; 
    // const { id_paket_langganan } = req.body;
    const id_user = req.user.id_user || req.user.id;
    const { id_paket_langganan } = req.body;

    try {
        // Cek Apakah User Valid
        const user = await prisma.users.findUnique({
            where: { id_user: parseInt(id_user) }
        });
        
        if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

        // Cek Paket Langganan & Hitung Harga Real-time
        const paket = await prisma.paketLangganan.findUnique({
            where: { id_paket_langganan: parseInt(id_paket_langganan) },
            include: { diskonPaket: true } // Include diskon untuk cek harga coret
        });

        if (!paket) return res.status(404).json({ message: "Paket tidak ditemukan" });

        // --- LOGIKA HITUNG HARGA
        let grossAmount = paket.harga; // Harga Default
        const today = new Date();

        // Cek Diskon Aktif
        if (paket.diskonPaket && paket.diskonPaket.length > 0) {
            const diskonInfo = paket.diskonPaket[0];
            const startDate = new Date(diskonInfo.tanggal_mulai_diskon);
            const endDate = new Date(diskonInfo.tanggal_selesai_diskon);

            // Jika hari ini masuk rentang diskon
            if (today >= startDate && today <= endDate) {
                const diskonNominal = (paket.harga * diskonInfo.diskon) / 100;
                grossAmount = paket.harga - diskonNominal;
            }
        }

        const transaksiBaru = await prisma.transaksi.create({
            data: {
                id_paket_langganan: paket.id_paket_langganan,
                id_subscriber: user.id_user,
                amount: parseInt(grossAmount), 
                status: 'pending',
            }
        });

        // Siapkan Parameter untuk Midtrans
        const parameter = {
            transaction_details: {
                order_id: transaksiBaru.id_transaksi, // Gunakan UUID dari tabel Transaksi
                gross_amount: parseInt(grossAmount)
            },
            customer_details: {
                first_name: user.nama_user,
                email: user.email_user,
                phone: user.phone || ""
            },
            item_details: [{
                id: `PKT-${paket.id_paket_langganan}`,
                price: parseInt(grossAmount),
                quantity: 1,
                name: paket.nama_paket.substring(0, 50) 
            }]
        };

        // Minta Token ke Server Midtrans
        const transactionToken = await snap.createTransaction(parameter);
        
        // Update Database: Simpan Token yang didapat
        await prisma.transaksi.update({
            where: { id_transaksi: transaksiBaru.id_transaksi },
            data: { snap_token: transactionToken.token }
        });

        // Kirim Token ke Frontend
        res.status(200).json({
            message: "Token transaksi berhasil dibuat",
            token: transactionToken.token,
            redirect_url: transactionToken.redirect_url, // URL pembayaran (opsional)
            order_id: transaksiBaru.id_transaksi
        });

    } catch (error) {
        console.error("Midtrans Error:", error);
        res.status(500).json({ message: "Gagal memproses transaksi", error: error.message });
    }
};