const { sendInvoiceEmail } = require('../services/emailService');
const prisma = require('../config/prismaClient');

// 1. GET ALL TRANSAKSI
exports.getAllTransactions = async (req, res) => {
    try {
        const data = await prisma.transaksi.findMany({
            include: {
                subscriber: {
                    select: { nama_subscriber: true, email_subscriber: true, phone: true }
                },
                paketLangganan: {
                    select: { nama_paket: true, masa_berlaku: true, nama_periode: true }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        const formattedData = data.map(item => {
            const sub = item.subscriber || {}; 
            const pkt = item.paketLangganan || {}; 

            // Logic Mapping Status
            let statusFrontend = 'pending';
            if (item.status === 'success') statusFrontend = 'active';
            if (item.status === 'failed') statusFrontend = 'expired';
            if (item.status === 'suspended') statusFrontend = 'suspended';

            // Hitung Tanggal Berakhir
            const tanggalBeli = new Date(item.created_at);
            let tanggalBerakhir = new Date(item.created_at);

            if ((statusFrontend === 'active' || statusFrontend === 'suspended') && pkt.masa_berlaku) {
                const durasi = pkt.masa_berlaku;
                const periode = pkt.nama_periode ? pkt.nama_periode.toLowerCase() : 'bulan';

                if (periode.includes('hari')) tanggalBerakhir.setDate(tanggalBeli.getDate() + durasi);
                else if (periode.includes('minggu')) tanggalBerakhir.setDate(tanggalBeli.getDate() + (durasi * 7));
                else if (periode.includes('tahun')) tanggalBerakhir.setFullYear(tanggalBeli.getFullYear() + durasi);
                else tanggalBerakhir.setMonth(tanggalBeli.getMonth() + durasi);
            }

            return {
                id: item.id_transaksi,
                nama: sub.nama_subscriber || "Subscriber Tidak Dikenal", 
                email: sub.email_subscriber || "-",
                telpn: sub.phone || "-",
                langganan: pkt.nama_paket || "Paket Tidak Ditemukan", 
                status: statusFrontend,
                tanggal_pembelian: tanggalBeli.toLocaleDateString('id-ID'),
                tanggal_berakhir: (statusFrontend === 'active' || statusFrontend === 'suspended')
                    ? tanggalBerakhir.toLocaleDateString('id-ID') 
                    : "-", 
                amount: item.amount
            };
        });

        res.status(200).json(formattedData);
    } catch (error) {
        console.error("Error Get Subscribers:", error);
        res.status(500).json({ message: "Gagal mengambil data subscriber" });
    }
};

// 2. GET DETAIL TRANSAKSI
exports.getTransactionDetail = async (req, res) => {
    const { id } = req.params;
    try {
        const item = await prisma.transaksi.findUnique({
            where: { id_transaksi: id },
            include: {
                subscriber: true,
                paketLangganan: {
                    include: {
                        diskonPaket: true 
                    }
                }
            }
        });

        if (!item) return res.status(404).json({ message: "Data tidak ditemukan" });
        const tanggalBeli = new Date(item.created_at);
        const totalBayar = item.amount;
        
        let hargaAsli = totalBayar;
        let diskonPersen = 0;

        const diskonSaatItu = item.paketLangganan?.diskonPaket?.find(d => {
            const mulai = new Date(d.tanggal_mulai_diskon);
            const selesai = new Date(d.tanggal_selesai_diskon);
            return tanggalBeli >= mulai && tanggalBeli <= selesai;
        });

        if (diskonSaatItu && diskonSaatItu.diskon > 0) {
            const persentase = diskonSaatItu.diskon; 
            
            hargaAsli = totalBayar / (1 - (persentase / 100));
            diskonPersen = persentase;
        }

        let masaBerlakuText = "-";
        
        if (item.paketLangganan) {
            const angka = item.paketLangganan.masa_berlaku || 0;
            const periode = item.paketLangganan.nama_periode || "Bulan"; 
            
            const periodeKapital = periode.charAt(0).toUpperCase() + periode.slice(1);
            
            // Gabungkan Angka + Spasi + Periode
            masaBerlakuText = `${angka} ${periodeKapital}`; 
        }

        const responseData = {
            ...item,
            subscriber: {
                ...item.subscriber,
                nama_user: item.subscriber?.nama_subscriber,
                email_user: item.subscriber?.email_subscriber
            },
            paketLangganan: item.paketLangganan || {},
            
            pricing_detail: {
                harga_asli: Math.round(hargaAsli), 
                diskon_persen: diskonPersen > 0 ? `${diskonPersen}%` : null,
                total_bayar: totalBayar,
                masa_berlaku_text: masaBerlakuText
            }
        };

        res.status(200).json(responseData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error server" });
    }
};

// 3. HANDLE AKSI (VERIFY / REJECT / SUSPEND / UNSUSPEND)
exports.updateTransactionStatus = async (req, res) => {
    const { id } = req.params; 
    const { action } = req.body; 

    try {
        const tx = await prisma.transaksi.findUnique({
            where: { id_transaksi: id },
            include: { paketLangganan: true }
        });

        if (!tx) return res.status(404).json({ message: "Transaksi tidak ditemukan" });

        // A. VERIFIKASI MANUAL
        // if (action === 'verify') {
        //     const updatedTx = await prisma.transaksi.update({
        //         where: { id_transaksi: id },
        //         data: { status: 'success' },
        //         include: {
        //             subscriber: true,
        //             paketLangganan: {
        //                 include: { diskonPaket: true }
        //             }
        //         }
        //     });
        //     await activateSubscription(updatedTx.id_subscriber, updatedTx.paketLangganan);
        //     await prisma.transaksi.update({
        //         where: { id_transaksi: id },
        //         data: { status: 'success' }
        //     });
        //     await activateSubscription(tx.id_subscriber, tx.paketLangganan);
        //     console.log("Mengirim invoice manual verification...");
        //     await sendInvoiceEmail(updatedTx);

        //     return res.status(200).json({ message: "Transaksi diverifikasi & Invoice dikirim!" });
        // }

        // A. VERIFIKASI MANUAL
        if (action === 'verify') {
            const updatedTx = await prisma.transaksi.update({
                where: { id_transaksi: id },
                data: { status: 'success' },
                include: {
                    subscriber: true,
                    paketLangganan: {
                        include: { diskonPaket: true }
                    }
                }
            });

            await activateSubscription(updatedTx.id_subscriber, updatedTx.paketLangganan);
            console.log("Memulai proses kirim email di background...");
            
            sendInvoiceEmail(updatedTx)
                .then(() => console.log("Email berhasil terkirim (Background process)"))
                .catch(err => console.error("Gagal kirim email di background:", err));
            return res.status(200).json({ message: "Verifikasi berhasil! Invoice sedang dikirim." });
        }

        // B. TOLAK TRANSAKSI
        if (action === 'reject') {
            await prisma.transaksi.update({
                where: { id_transaksi: id },
                data: { status: 'failed' }
            });
            return res.status(200).json({ message: "Transaksi ditolak." });
        }

        // C. SUSPEND (BLOKIR)
        if (action === 'suspend') {
            await prisma.subscribePaket.updateMany({
                where: { 
                    id_subscriber: tx.id_subscriber,
                    status: 'active' 
                },
                data: { status: 'inactive' }
            });

            await prisma.transaksi.update({
                where: { id_transaksi: id },
                data: { status: 'suspended' } 
            });

            return res.status(200).json({ message: "Paket Langganan berhasil di-suspend." });
        }

        // D. UNSUSPEND (BUKA BLOKIR)
        if (action === 'unsuspend') {
            await prisma.subscribePaket.updateMany({
                where: { 
                    id_subscriber: tx.id_subscriber, 
                    status: 'inactive' 
                },
                data: { status: 'active' } 
            });

            // Kembalikan Transaksi ke status 'success'
            await prisma.transaksi.update({
                where: { id_transaksi: id },
                data: { status: 'success' } 
            });

            return res.status(200).json({ message: "Suspend dibuka! Paket aktif kembali." });
        }

        return res.status(400).json({ message: "Aksi tidak dikenali" });

    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ message: "Gagal memproses aksi" });
    }
};

// Fungsi Bantuan: Membuat Data di SubscribePaket
async function activateSubscription(userId, paket) {
    if (!paket) return; // Safety check

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
            id_subscriber: userId,
            id_paket_langganan: paket.id_paket_langganan,
            tanggal_subscribe: new Date(),
            tanggal_mulai: today,
            tanggal_selesai: endDate,
            status: 'active' // Enum StatusSubscribe
        }
    });
};

exports.resendInvoice = async (req, res) => {
    const { id } = req.params; // ID Transaksi

    try {
        // Ambil data lengkap transaksi
        const tx = await prisma.transaksi.findUnique({
            where: { id_transaksi: id },
            include: {
                subscriber: true,
                paketLangganan: {
                    include: {
                        diskonPaket: true
                    }
                }
            }
        });

        if (!tx) return res.status(404).json({ message: "Transaksi tidak ditemukan" });

        // Panggil service email
        const isSent = await sendInvoiceEmail(tx);

        if (isSent) {
            return res.status(200).json({ message: "Invoice berhasil dikirim ulang ke email subscriber." });
        } else {
            return res.status(500).json({ message: "Gagal mengirim email (Masalah Server Email)." });
        }

    } catch (error) {
        console.error("Resend Error:", error);
        res.status(500).json({ message: "Terjadi kesalahan server" });
    }
};