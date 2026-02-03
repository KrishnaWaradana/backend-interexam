const prisma = require('../config/prismaClient');

// CREATE PAKET (Tanpa Kategori / All Access) ---
exports.createPackage = async (req, res) => {
    console.log("Request Masuk ke Create Package!");
    console.log("Body:", req.body);
    
    const { nama_paket, harga_asli, masa_berlaku, masa_periode, status } = req.body;

    try {
        const newPackage = await prisma.paketLangganan.create({
            data: {
                nama_paket,
                harga: parseInt(harga_asli),
                masa_berlaku: parseInt(masa_berlaku),
                nama_periode: masa_periode.toLowerCase(), 
                status: status === "Aktif" ? "active" : "inactive",
            }
        });

        res.status(201).json({ message: "Paket berhasil dibuat", data: newPackage });
    } catch (error) {
        console.error("Error Create Package:", error);
        res.status(500).json({ message: "Gagal membuat paket", error: error.message });
    }
};

// GET ALL PAKET (Dengan Hitungan Diskon) 
exports.getAllPackages = async (req, res) => {
    try {
        const packages = await prisma.paketLangganan.findMany({
            include: {
                diskonPaket: true 
            },
            orderBy: { id_paket_langganan: 'desc' }
        });

        // Logic Hitung Diskon
        const processedPackages = packages.map(pkg => {
            const today = new Date();
            let finalPrice = pkg.harga;
            
            // 1. Ambil Settingan Diskon Terakhir (Untuk Form Edit di Modal)
            // Karena kita pakai deleteMany sebelum create, harusnya cuma ada 1 atau 0.
            const discountSetting = pkg.diskonPaket.length > 0 ? pkg.diskonPaket[0] : null;

            // 2. Cek Apakah Diskon Sedang AKTIF (Untuk Harga Coret di Tabel)
            let isActivePromo = false;
            
            if (discountSetting) {
                const startDate = new Date(discountSetting.tanggal_mulai_diskon);
                const endDate = new Date(discountSetting.tanggal_selesai_diskon);

                if (today >= startDate && today <= endDate) {
                    isActivePromo = true;
                    // Hitung harga diskon
                    finalPrice = pkg.harga - (pkg.harga * discountSetting.diskon / 100);
                }
            }

            return {
                ...pkg,
                harga_asli: pkg.harga,
                harga_akhir: finalPrice, 
                
                // DATA PENTING KE FRONTEND:
                is_promo: isActivePromo,       // True jika tanggal masuk range (tampilkan harga coret)
                diskon_info: discountSetting   // Data mentah (untuk isi form modal, meskipun belum aktif)
            };
        });

        res.status(200).json({ message: "Data paket diambil", data: processedPackages });
    } catch (error) {
        console.error("Error Get Packages:", error);
        res.status(500).json({ message: "Gagal mengambil data paket", error: error.message });
    }
};

// --- ATUR DISKON PAKET ---
    exports.setDiscount = async (req, res) => {
    const { id_paket_langganan, diskon, tanggal_mulai, tanggal_selesai } = req.body;

    try {
        const paket = await prisma.paketLangganan.findUnique({
            where: { id_paket_langganan: parseInt(id_paket_langganan) }
        });

        if (!paket) return res.status(404).json({ message: "Paket tidak ditemukan" });

        await prisma.diskonPaket.deleteMany({
            where: { id_paket_langganan: parseInt(id_paket_langganan) }
        });

        const newDiscount = await prisma.diskonPaket.create({
            data: {
                id_paket_langganan: parseInt(id_paket_langganan),
                diskon: parseFloat(diskon),
                tanggal_mulai_diskon: new Date(tanggal_mulai),
                tanggal_selesai_diskon: new Date(tanggal_selesai)
            }
        });

        res.status(200).json({ message: "Diskon berhasil diatur", data: newDiscount });

    } catch (error) {
        console.error("Error Set Discount:", error);
        res.status(500).json({ message: "Gagal mengatur diskon", error: error.message });
    }
};


// delete paket
exports.deletePackage = async (req, res) => {
    const { id } = req.params;

    try {
        const paketId = parseInt(id);

        const existingPackage = await prisma.paketLangganan.findUnique({
            where: { id_paket_langganan: paketId }
        });

        if (!existingPackage) {
            return res.status(404).json({ message: "Paket tidak ditemukan" });
        }

        // Hapus diskon dulu (relasi)
        await prisma.diskonPaket.deleteMany({
            where: { id_paket_langganan: paketId }
        });

        // Baru hapus paket
        await prisma.paketLangganan.delete({
            where: { id_paket_langganan: paketId }
        });

        res.status(200).json({ message: "Paket berhasil dihapus permanen" });

    } catch (error) {
        console.error("Error Delete Package:", error);
        if (error.code === 'P2003') {
            return res.status(400).json({ 
                message: "Gagal hapus: Paket ini sudah pernah dibeli user." 
            });
        }
        res.status(500).json({ message: "Gagal menghapus paket", error: error.message });
    }
};

// ==========================================
// 5. GET SINGLE PAKET (Untuk Form Edit)
// ==========================================
exports.getPackageById = async (req, res) => {
    const { id } = req.params;
    try {
        const paket = await prisma.paketLangganan.findUnique({
            where: { id_paket_langganan: parseInt(id) }
        });

        if (!paket) return res.status(404).json({ message: "Paket tidak ditemukan" });

        res.status(200).json({ message: "Detail paket diambil", data: paket });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error mengambil data paket" });
    }
};

// ==========================================
// 6. UPDATE PAKET
// ==========================================
exports.updatePackage = async (req, res) => {
    const { id } = req.params;
    const { nama_paket, harga_asli, masa_berlaku, masa_periode, status } = req.body;

    try {
        const updatedPackage = await prisma.paketLangganan.update({
            where: { id_paket_langganan: parseInt(id) },
            data: {
                nama_paket,
                harga: parseInt(harga_asli),
                masa_berlaku: parseInt(masa_berlaku),
                nama_periode: masa_periode.toLowerCase(),
                status: status === "Aktif" ? "active" : "inactive",
            }
        });

        res.status(200).json({ message: "Paket berhasil diperbarui", data: updatedPackage });
    } catch (error) {
        console.error("Error Update Package:", error);
        res.status(500).json({ message: "Gagal memperbarui paket", error: error.message });
    }
};