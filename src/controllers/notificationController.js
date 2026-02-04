const { sendInvoiceEmail } = require('../services/emailService');
const prisma = require('../config/prismaClient'); 
const midtransClient = require('midtrans-client');
const crypto = require('crypto');

const apiClient = new midtransClient.CoreApi({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

exports.handleNotification = async (req, res) => {
    try {
        const notificationJson = req.body;
        let statusResponse;

        // Cek Signature / Mode Simulasi
        if (notificationJson.signature_key === "tidak-dicek-karena-sandbox-simulasi") {
            console.log(" Menggunakan Mode Simulasi (Bypass Verification)");
            statusResponse = notificationJson; 
        } else {
            statusResponse = await apiClient.transaction.notification(notificationJson);
        }

        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        console.log(`Notifikasi masuk: ${orderId} | Status: ${transactionStatus} | Fraud: ${fraudStatus}`);

        // Cek Transaksi di Database
        const transaksi = await prisma.transaksi.findUnique({
            where: { id_transaksi: orderId },
            include: { paketLangganan: true } 
        });

        if (!transaksi) {
            return res.status(404).json({ message: "Transaksi tidak ditemukan" });
        }

        // Tentukan Status Akhir
        let newStatus = 'pending';
        let isPaid = false;

        if (transactionStatus == 'capture') {
            if (fraudStatus == 'accept') {
                newStatus = 'success'; 
                isPaid = true;
            }
        } else if (transactionStatus == 'settlement') {
            newStatus = 'success'; // Transfer Bank / E-Wallet Sukses
            isPaid = true;
        } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
            newStatus = 'failed';
        } else if (transactionStatus == 'pending') {
            newStatus = 'pending';
        }

        // Update Database & Eksekusi Aksi
        if (isPaid) {
            // Update Status Jadi Success
            const updatedTx = await prisma.transaksi.update({
                where: { id_transaksi: orderId },
                data: { 
                    status: 'success',
                    payment_type: statusResponse.payment_type 
                },
                include: {
                    subscriber: true,
                    paketLangganan: {
                        include: {
                            diskonPaket: true 
                        }
                    }
                }
            });

            // Aktifkan Langganan (Cek agar tidak double aktivasi jika notifikasi dikirim 2x oleh midtrans)
            const cekLangganan = await prisma.subscribePaket.findFirst({
                where: { 
                    id_subscriber: updatedTx.id_subscriber,
                    id_paket_langganan: updatedTx.id_paket_langganan,
                    status: 'active',
                    tanggal_subscribe: {
                        gte: new Date(new Date().setMinutes(new Date().getMinutes() - 5)) // Cek 5 menit terakhir
                    }
                }
            });

            if (!cekLangganan) {
                console.log("Mengaktifkan langganan...");
                await activateSubscription(updatedTx.id_subscriber, updatedTx.paketLangganan);
                
                console.log("Mengirim email invoice...");
                await sendInvoiceEmail(updatedTx);
            } else {
                console.log("Langganan sudah aktif sebelumnya, skip aktivasi ulang.");
            }

        } else {
            // Jika Gagal / Pending / Expired
            await prisma.transaksi.update({
                where: { id_transaksi: orderId },
                data: { 
                    status: newStatus,
                    payment_type: statusResponse.payment_type 
                }
            });
        }

        res.status(200).json({ status: 'OK' });

    } catch (error) {
        console.error("Notification Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Fungsi Helper (Tetap sama)
async function activateSubscription(userId, paket) {
    if (!paket) return;

    const today = new Date();
    let endDate = new Date();

    const durasi = paket.masa_berlaku || 1;
    const periode = paket.nama_periode ? paket.nama_periode.toLowerCase() : 'bulan';

    if (periode.includes('hari')) {
        endDate.setDate(today.getDate() + durasi);
    } else if (periode.includes('minggu')) {
        endDate.setDate(today.getDate() + (durasi * 7));
    } else if (periode.includes('tahun')) {
        endDate.setFullYear(today.getFullYear() + durasi);
    } else {
        endDate.setMonth(today.getMonth() + durasi);
    }

    await prisma.subscribePaket.create({
        data: {
            id_subscriber: userId,
            id_paket_langganan: paket.id_paket_langganan,
            tanggal_subscribe: new Date(),
            tanggal_mulai: today,
            tanggal_selesai: endDate,
            status: 'active'
        }
    });

    console.log(`Paket untuk User ID ${userId} berhasil diaktifkan sampai ${endDate}`);
}