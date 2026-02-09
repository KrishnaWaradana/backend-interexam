const prisma = require('../config/prismaClient');
const { sendInvoiceEmail } = require('../services/emailService'); 

exports.handleNotification = async (req, res) => {
    try {
        const notificationJson = req.body;
        
        // Ambil Data dari Midtrans
        const orderId = notificationJson.order_id;
        const transactionStatus = notificationJson.transaction_status;
        const fraudStatus = notificationJson.fraud_status;

        console.log(`Notifikasi Masuk: ${orderId} | Status Midtrans: ${transactionStatus}`);

        // Cek Transaksi di Database
        const transaksi = await prisma.transaksi.findUnique({
            where: { id_transaksi: orderId }
        });

        if (!transaksi) {
            return res.status(404).json({ message: "Transaksi tidak ditemukan" });
        }

        // Tentukan Status Akhir 
        let newStatus = 'pending';
        
        if (transactionStatus == 'capture') {
            if (fraudStatus == 'accept') newStatus = 'success';
        } else if (transactionStatus == 'settlement') {
            newStatus = 'success'; 
        } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
            newStatus = 'failed';
        }

        console.log(`Update DB Menjadi: ${newStatus.toUpperCase()}`);

        // PROSES UPDATE & EMAIL
        if (newStatus === 'success') {
            
            // Update Status & SIMPAN HASILNYA ke 'updatedTx'
            const updatedTx = await prisma.transaksi.update({
                where: { id_transaksi: orderId },
                data: { 
                    status: 'success', 
                    payment_type: notificationJson.payment_type 
                },
                include: { 
                    subscriber: true,       
                    paketLangganan: true   
                }
            });

            // Aktifkan Paket
            const cekLangganan = await prisma.subscribePaket.findFirst({
                where: { 
                    id_subscriber: updatedTx.id_subscriber, 
                    id_paket_langganan: updatedTx.id_paket_langganan,
                    status: 'active'
                }
            });

            if (!cekLangganan) {
                console.log("Mengaktifkan Paket Langganan...");
                await activateSubscription(updatedTx.id_subscriber, updatedTx.paketLangganan);
            }

            // KIRIM EMAIL OTOMATIS
            console.log("Mengirim Email Invoice Otomatis...");
            try {
                await sendInvoiceEmail(updatedTx); 
                console.log("Email terkirim!");
            } catch (emailError) {
                console.error("Gagal kirim email (tapi transaksi aman):", emailError.message);
            }

        } else {
            // Jika Gagal/Pending/Expired
            await prisma.transaksi.update({
                where: { id_transaksi: orderId },
                data: { status: newStatus }
            });
        }

        res.status(200).json({ status: 'OK' });

    } catch (error) {
        console.error("🔥 Error Notification:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// --- FUNGSI HELPER (AKTIVASI PAKET) ---
async function activateSubscription(subscriberId, paket) {
    if (!paket) return;
    const today = new Date();
    let endDate = new Date();
    const durasi = paket.masa_berlaku || 1;
    const periode = paket.nama_periode ? paket.nama_periode.toLowerCase() : 'bulan';

    if (periode.includes('hari')) endDate.setDate(today.getDate() + durasi);
    else if (periode.includes('minggu')) endDate.setDate(today.getDate() + (durasi * 7));
    else if (periode.includes('tahun')) endDate.setFullYear(today.getFullYear() + durasi);
    else endDate.setMonth(today.getMonth() + durasi);

    await prisma.subscribePaket.create({
        data: {
            id_subscriber: subscriberId,
            id_paket_langganan: paket.id_paket_langganan,
            tanggal_subscribe: new Date(),
            tanggal_mulai: today,
            tanggal_selesai: endDate,
            status: 'active'
        }
    });
}