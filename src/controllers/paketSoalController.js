const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

// --- 1. GET DATA UNTUK MODAL BANK SOAL ---
// Endpoint ini dipanggil saat Admin buka modal "Add Soal"
// Menampilkan hanya soal yang statusnya "Disetujui"
exports.getBankSoal = async (req, res) => {
    try {
        const { subject_id, level, jenis_soal } = req.query; // Filter opsional

        // Build Filter
        const whereClause = {
            status: 'disetujui' // WAJIB: Hanya soal yg sudah diapprove
        };

        if (level) whereClause.level_kesulitan = level;
        if (jenis_soal) whereClause.jenis_soal = jenis_soal;
        
        // Filter by Subject agak tricky karena relasinya: Soal -> Topic -> Subject
        if (subject_id) {
            whereClause.topic = {
                id_subjects: parseInt(subject_id)
            };
        }

        const soalList = await prisma.soal.findMany({
            where: whereClause,
            select: {
                id_soal: true,
                text_soal: true,
                jenis_soal: true,
                level_kesulitan: true,
                topic: {
                    select: {
                        subject: {
                            select: { nama_subject: true }
                        }
                    }
                }
            },
            orderBy: { id_soal: 'desc' }
        });

        // Flatten data supaya frontend enak bacanya (ambil nama mapelnya)
        const formattedData = soalList.map(soal => ({
            id: soal.id_soal,
            mapel: soal.topic?.subject?.nama_subject || '-',
            soal: soal.text_soal.substring(0, 100) + '...', // Potong text biar gak kepanjangan
            tipe: soal.jenis_soal,
            level: soal.level_kesulitan,
            status: 'Disetujui' // Hardcode karena emang filter disetujui
        }));

        res.status(200).json({ data: formattedData });

    } catch (error) {
        console.error("Error getBankSoal:", error);
        res.status(500).json({ message: "Gagal mengambil data bank soal." });
    }
};

// --- 2. CREATE PAKET SOAL (TRANSACTION) ---
// Ini dipanggil saat tombol "Simpan" diklik
exports.createPaketSoal = async (req, res) => {
    /*
      req.body akan berisi:
      - nama_paket
      - id_category (Kategori Paket)
      - status (Active/Draft)
      - soal_ids (Array ID Soal yang dipilih: "[1, 5, 10]") -> Dikirim sebagai String JSON kalau via FormData
    */
    const { nama_paket, id_category, status, soal_ids } = req.body;
    const imagePath = req.file ? req.file.path : null;
    const creatorId = req.user.id; // Dari Token

    // Parsing soal_ids karena FormData mengirim array sebagai string
    let parsedSoalIds = [];
    if (soal_ids) {
        try {
            parsedSoalIds = JSON.parse(soal_ids); // Contoh input: "[1, 2, 3]"
        } catch (e) {
            // Fallback kalau dikirim bukan JSON string tapi array biasa (tergantung library frontend)
            parsedSoalIds = Array.isArray(soal_ids) ? soal_ids : [soal_ids];
        }
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Hitung Durasi Total (Opsional: ambil sum durasi dari masing-masing soal jika ada datanya)
            // Untuk MVP, kita set manual atau 0 dulu.
            
            // 2. Buat Paket Soal Header
            const newPaket = await tx.paketSoal.create({
                data: {
                    nama_paket,
                    id_category: parseInt(id_category),
                    status: status || 'draft',
                    image: imagePath,
                    id_creator: creatorId,
                    jumlah_soal: parsedSoalIds.length,
                    tanggal_dibuat: new Date()
                }
            });

            // 3. Masukkan Soal-soal ke Junction Table (soal_paket_soal)
            if (parsedSoalIds.length > 0) {
                // Siapkan data bulk insert
                const junctionData = parsedSoalIds.map(idSoal => ({
                    id_paket_soal: newPaket.id_paket_soal,
                    id_soal: parseInt(idSoal),
                    point: 1, // Default point, bisa diubah nanti
                    durasi: 0 // Default durasi per soal
                }));

                await tx.soalPaketSoal.createMany({
                    data: junctionData
                });
            }

            return newPaket;
        });

        res.status(201).json({ 
            message: "Paket soal berhasil dibuat!", 
            data: result 
        });

    } catch (error) {
        console.error("Error createPaketSoal:", error);
        // Hapus gambar jika transaksi database gagal (biar gak nyampah)
        if (imagePath && fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
        res.status(500).json({ message: "Gagal membuat paket soal.", error: error.message });
    }
};

// --- 3. GET LIST PAKET SOAL (Untuk Dashboard Paket Soal) ---
exports.getAllPaket = async (req, res) => {
    try {
        const paket = await prisma.paketSoal.findMany({
            include: {
                category: true, // Ambil nama kategori
                _count: {
                    select: { soalPaket: true } // Hitung jumlah soal real
                }
            },
            orderBy: { id_paket_soal: 'desc' }
        });
        
        res.status(200).json({ data: paket });
    } catch (error) {
        res.status(500).json({ message: "Gagal ambil paket soal." });
    }
};

// --- 4. GET DETAIL PAKET (Read One) ---
// Dipanggil saat Admin klik tombol "Edit" (icon pensil) atau "View" (icon mata)
exports.getPaketById = async (req, res) => {
    const { id } = req.params;
    try {
        const paket = await prisma.paketSoal.findUnique({
            where: { id_paket_soal: parseInt(id) },
            include: {
                category: true,
                // Ambil daftar soal yang ada di paket ini
                soalPaket: {
                    include: {
                        soal: {
                            select: {
                                id_soal: true,
                                text_soal: true,
                                jenis_soal: true,
                                level_kesulitan: true
                            }
                        }
                    }
                }
            }
        });

        if (!paket) return res.status(404).json({ message: "Paket soal tidak ditemukan." });

        // Format ulang data soal biar frontend gampang bacanya
        // Mengubah struktur dari "Junction Table" ke "Array of Soal"
        const formattedPaket = {
            ...paket,
            list_soal: paket.soalPaket.map(item => ({
                id: item.soal.id_soal,
                text: item.soal.text_soal,
                jenis: item.soal.jenis_soal,
                level: item.soal.level_kesulitan
            }))
        };

        res.status(200).json({ data: formattedPaket });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Gagal mengambil detail paket." });
    }
};

// --- 5. UPDATE PAKET SOAL (Edit) ---
exports.updatePaketSoal = async (req, res) => {
    const { id } = req.params;
    /*
      Body sama seperti Create: 
      nama_paket, id_category, status, soal_ids (JSON String)
    */
    const { nama_paket, id_category, status, soal_ids } = req.body;
    const newImage = req.file ? req.file.path : null;

    try {
        // Cek dulu paket lama untuk ambil info gambar lama
        const oldPaket = await prisma.paketSoal.findUnique({ where: { id_paket_soal: parseInt(id) } });
        if (!oldPaket) {
            if (newImage && fs.existsSync(newImage)) fs.unlinkSync(newImage); // Hapus gambar baru klo gagal
            return res.status(404).json({ message: "Paket tidak ditemukan." });
        }

        const result = await prisma.$transaction(async (tx) => {
            // A. Update Data Header
            const updateData = {
                nama_paket,
                id_category: id_category ? parseInt(id_category) : undefined,
                status,
                // Jika ada gambar baru, pakai yg baru. Jika tidak, tetap yg lama.
                image: newImage || oldPaket.image 
            };
            
            // Logic Hapus Gambar Lama
            if (newImage && oldPaket.image && fs.existsSync(oldPaket.image)) {
                fs.unlinkSync(oldPaket.image);
            }

            // B. Update Relasi Soal (HANYA JIKA soal_ids DIKIRIM)
            // Caranya: Hapus semua relasi lama -> Buat relasi baru (Reset)
            let totalSoal = oldPaket.jumlah_soal; // Default pakai lama

            if (soal_ids) {
                // 1. Parsing Input
                let parsedSoalIds = [];
                try {
                    parsedSoalIds = JSON.parse(soal_ids);
                } catch (e) {
                    parsedSoalIds = Array.isArray(soal_ids) ? soal_ids : [soal_ids];
                }

                // 2. Hapus relasi lama di tabel junction
                await tx.soalPaketSoal.deleteMany({
                    where: { id_paket_soal: parseInt(id) }
                });

                // 3. Masukkan relasi baru
                if (parsedSoalIds.length > 0) {
                    const junctionData = parsedSoalIds.map(idSoal => ({
                        id_paket_soal: parseInt(id),
                        id_soal: parseInt(idSoal),
                        point: 1, 
                        durasi: 0
                    }));
                    await tx.soalPaketSoal.createMany({ data: junctionData });
                }
                
                // Update jumlah soal di header
                updateData.jumlah_soal = parsedSoalIds.length;
            }

            // Eksekusi Update Header
            const updatedPaket = await tx.paketSoal.update({
                where: { id_paket_soal: parseInt(id) },
                data: updateData
            });

            return updatedPaket;
        });

        res.status(200).json({ message: "Paket soal berhasil diupdate.", data: result });

    } catch (error) {
        console.error(error);
        if (newImage && fs.existsSync(newImage)) fs.unlinkSync(newImage);
        res.status(500).json({ message: "Gagal update paket." });
    }
};

// --- 6. DELETE PAKET SOAL ---
exports.deletePaketSoal = async (req, res) => {
    const { id } = req.params;

    try {
        // Cek paket untuk hapus gambar
        const paket = await prisma.paketSoal.findUnique({ where: { id_paket_soal: parseInt(id) } });
        if (!paket) return res.status(404).json({ message: "Paket tidak ditemukan." });

        await prisma.$transaction(async (tx) => {
            // 1. Hapus Relasi di Junction Table dulu (soal_paket_soal)
            await tx.soalPaketSoal.deleteMany({
                where: { id_paket_soal: parseInt(id) }
            });

            // 2. Hapus History Pengerjaan / Attempt jika ada (PENTING biar ga error constraint)
            await tx.paketAttempt.deleteMany({
                 where: { paket_soal_id_paket_soal: parseInt(id) }
            });

            // 3. Hapus Paket Utama
            await tx.paketSoal.delete({
                where: { id_paket_soal: parseInt(id) }
            });
        });

        // 4. Hapus File Gambar dari folder
        if (paket.image && fs.existsSync(paket.image)) {
            fs.unlinkSync(paket.image);
        }

        res.status(200).json({ message: "Paket soal berhasil dihapus." });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Gagal menghapus paket soal. Mungkin paket ini sudah pernah dikerjakan siswa." });
    }
};

// --- 7. UPDATE STATUS ONLY (Toggle Switch di Dashboard) ---
exports.updateStatusPaket = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // active, inactive, draft

    try {
        // Validasi Enum
        const validStatus = ['active', 'inactive', 'draft'];
        if (!validStatus.includes(status)) {
            return res.status(400).json({ message: "Status tidak valid. Gunakan: active, inactive, atau draft." });
        }

        const updated = await prisma.paketSoal.update({
            where: { id_paket_soal: parseInt(id) },
            data: { status: status }
        });

        res.status(200).json({ message: `Status paket berhasil diubah jadi ${status}.`, data: updated });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Gagal update status." });
    }
};