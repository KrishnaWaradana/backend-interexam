const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendInvoiceEmail = async (transactionData) => {
    try {
        const templatePath = path.join(__dirname, '../templates/invoice.html');
        const templateSource = fs.readFileSync(templatePath, 'utf-8');
        const template = handlebars.compile(templateSource);

        const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
        
        const tglBeli = new Date(transactionData.created_at);
        const tglFormat = tglBeli.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        // --- LOGIKA HARGA & DISKON ---
        const totalBayar = transactionData.amount;
        let hargaAsli = totalBayar;
        
        // Variable untuk menampung tampilan diskon (Persen)
        let discountDisplay = ""; 
        let adaDiskon = false;

        // Pastikan array diskonPaket ada
        const daftarDiskon = transactionData.paketLangganan?.diskonPaket || [];

        const diskonSaatItu = daftarDiskon.find(d => {
            const mulai = new Date(d.tanggal_mulai_diskon);
            const selesai = new Date(d.tanggal_selesai_diskon);
            return tglBeli.getTime() >= mulai.getTime() && tglBeli.getTime() <= selesai.getTime();
        });

        if (diskonSaatItu && diskonSaatItu.diskon > 0) {
            const persentase = diskonSaatItu.diskon;
            
            // Hitung mundur Harga Asli
            hargaAsli = totalBayar / (1 - (persentase / 100));
            
            //Simpan dalam bentuk "20%" bukan Rupiah
            discountDisplay = `${persentase}%`; 
            
            adaDiskon = true;
        }

        // --- LOGIKA TANGGAL BERAKHIR ---
        let tglBerakhir = new Date(tglBeli);
        let masaBerlakuText = "-";

        if (transactionData.paketLangganan) {
            const durasi = transactionData.paketLangganan.masa_berlaku || 1;
            const periodeRaw = transactionData.paketLangganan.nama_periode || 'bulan';
            const periode = periodeRaw.toLowerCase();

            if (periode.includes('hari')) tglBerakhir.setDate(tglBeli.getDate() + durasi);
            else if (periode.includes('minggu')) tglBerakhir.setDate(tglBeli.getDate() + (durasi * 7));
            else if (periode.includes('tahun')) tglBerakhir.setFullYear(tglBeli.getFullYear() + durasi);
            else tglBerakhir.setMonth(tglBeli.getMonth() + durasi);

            const periodeCapital = periodeRaw.charAt(0).toUpperCase() + periodeRaw.slice(1);
            masaBerlakuText = `${durasi} ${periodeCapital}`;
        }
        
        const tglBerakhirFormat = tglBerakhir.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        // --- FORMAT METODE PEMBAYARAN ---
        let paymentMethod = "Manual Transfer";
        if (transactionData.payment_type) {
            paymentMethod = transactionData.payment_type.replace(/_/g, ' ').toUpperCase();
        }

        const htmlToSend = template({
            nama_user: transactionData.subscriber?.nama_subscriber || "Pelanggan",
            no_invoice: transactionData.id_transaksi.split('-')[0].toUpperCase(), 
            tanggal: tglFormat,
            metode_pembayaran: paymentMethod,
            
            nama_paket: transactionData.paketLangganan?.nama_paket || "Paket Langganan",
            masa_berlaku: masaBerlakuText,
            valid_until: tglBerakhirFormat, 
            
            harga_asli: formatIDR(Math.round(hargaAsli)), 
            
            ada_diskon: adaDiskon,
            nominal_diskon: discountDisplay, 
            
            total_bayar: formatIDR(totalBayar),
            link_dashboard: "http://localhost:5173/login" 
        });

        const info = await transporter.sendMail({
            from: '"InterExam Billing" <no-reply@interexam.com>',
            to: transactionData.subscriber.email_subscriber,
            subject: `✅ Pembayaran berhasil - Invoice Pembayaran #${transactionData.id_transaksi.split('-')[0]}`,
            html: htmlToSend
        });

        console.log("Email Invoice terkirim ID:", info.messageId);
        return true;

    } catch (error) {
        console.error("Gagal kirim email invoice:", error);
        return false;
    }
};

module.exports = { sendInvoiceEmail };