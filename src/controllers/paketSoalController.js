const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// ==========================================
// 1. GET BANK SOAL (Untuk Modal & Search)
// ==========================================
exports.getBankSoal = async (req, res) => {
    try {
        const { search, matapelajaran, jenjang, level, page = 1, limit = 10 } = req.query;
        
        // Setup Filter Awal: Hanya ambil soal yang sudah disetujui
        const whereClause = {
            status: 'disetujui' 
        };

        // Filter Pencarian Text (Case Insensitive)
        if (search) {
            whereClause.text_soal = { contains: search, mode: 'insensitive' };
        }

        // Filter Level Kesulitan
        if (level && level !== 'all') {
            whereClause.level_kesulitan = level.toLowerCase();
        }

        // Filter Relasi (Mapel & Jenjang via Topic)
        // Kita cek jika user memfilter salah satu atau keduanya
        if ((matapelajaran && matapelajaran !== 'all') || (jenjang && jenjang !== 'all')) {
            whereClause.topic = {}; // Inisialisasi object topic relation

            if (matapelajaran && matapelajaran !== 'all') {
                whereClause.topic.subject = {
                    nama_subject: matapelajaran // Pastikan nama di DB sama persis ("Matematika", dll)
                };
            }
            
            if (jenjang && jenjang !== 'all') {
                whereClause.topic.jenjang = {
                    nama_jenjang: jenjang // ("SMA", "SMP", dll)
                };
            }
        }

        // Pagination Logic
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Eksekusi Query (Transaction biar efisien)
        const [soalList, total] = await prisma.$transaction([
            prisma.soal.findMany({
                where: whereClause,
                include: {
                    topic: {
                        include: {
                            subject: true, // Ambil nama mapel
                            jenjang: true  // Ambil nama jenjang
                        }
                    }
                },
                skip: skip,
                take: parseInt(limit),
                orderBy: { id_soal: 'desc' }
            }),
            prisma.soal.count({ where: whereClause })
        ]);

        // Mapping Data agar sesuai kolom tabel Frontend
        const formattedData = soalList.map(item => ({
            id: item.id_soal,
            nama_soal: item.text_soal,
            matapelajaran: item.topic?.subject?.nama_subject || '-',
            jenjang: item.topic?.jenjang?.nama_jenjang || '-',
            tipe_soal: item.jenis_soal, // short_answer, multiple_choice, dll
            level: item.level_kesulitan, // mudah, sedang, sulit
            status: 'Disetujui' // Hardcode karena query di atas sudah filter 'disetujui'
        }));

        res.status(200).json({
            data: formattedData,
            meta: {
                total,
                page: parseInt(page),
                last_page: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error("Error getBankSoal:", error);
        res.status(500).json({ message: "Gagal mengambil data bank soal." });
    }
};

// ==========================================
// 2. CREATE PAKET SOAL
// ==========================================
exports.createPaketSoal = async (req, res) => {
    /*
        REQ BODY (FormData) yang dikirim Frontend:
        - nama_paket (String)
        - deskripsi (String)
        - jenis (String: "Gratis" | "Berbayar")
        - status (String: "Active" | "Inactive" | "Draft")
        - id_category (String angka: "1")
        - soal_ids (String JSON: "[1, 5, 10]") -> ID Soal yang dipilih & diurutkan
        - image (File Binary) -> Ditangkap oleh Multer sebagai req.file
    */
   
    const file = req.file;
    // Destructuring body
    const { nama_paket, deskripsi, jenis, status, id_category, soal_ids } = req.body;
    const id_creator = req.user.id; // Didapat dari Token Admin

    try {
        // --- A. Validasi & Parsing Data ---

        // 1. Parse soal_ids (Karena FormData mengirim array sebagai string)
        let parsedSoalIds = [];
        if (soal_ids) {
            try {
                parsedSoalIds = JSON.parse(soal_ids);
            } catch (e) {
                // Jika error parse, hapus gambar yang terlanjur diupload biar gak nyampah
                if (file) fs.unlinkSync(file.path);
                return res.status(400).json({ message: "Format soal_ids invalid (Harus JSON Array)." });
            }
        }

        // 2. Mapping Frontend ke Enum Database
        // Frontend kirim "Gratis" -> DB butuh "latihan"
        // Frontend kirim "Berbayar" -> DB butuh "try_out" (sesuai map schema kamu)
        let jenisDb = 'latihan'; 
        if (jenis === 'Berbayar') jenisDb = 'try_out';

        // Frontend kirim "Active" -> DB butuh "active" (lowercase)
        let statusDb = status ? status.toLowerCase() : 'draft';

        // 3. Pastikan ID Category angka
        const categoryInt = parseInt(id_category);
        if (isNaN(categoryInt)) {
            if (file) fs.unlinkSync(file.path);
            return res.status(400).json({ message: "ID Category harus berupa angka." });
        }

        // --- B. Simpan ke Database (Transaction) ---
        // Kita pakai Transaction supaya kalau simpan soal gagal, simpan paket juga dibatalkan
        const result = await prisma.$transaction(async (tx) => {
            
            // 1. Buat Header Paket Soal
            const newPaket = await tx.paketSoal.create({
                data: {
                    nama_paket,
                    deskripsi, // ✅ FIELD BARU SUDAH MASUK SINI
                    jenis: jenisDb,
                    status: statusDb,
                    image: file ? file.path : null, // Path file dari Multer
                    jumlah_soal: parsedSoalIds.length,
                    id_category: categoryInt,
                    id_creator: id_creator,
                    tanggal_dibuat: new Date() // Sesuai schema DateTime
                }
            });

            // 2. Simpan Detail Soal (Junction Table)
            // Loop array ID soal untuk dimasukkan ke tabel soal_paket_soal
            if (parsedSoalIds.length > 0) {
                const soalPaketData = parsedSoalIds.map((soalId) => ({
                    id_paket_soal: newPaket.id_paket_soal,
                    id_soal: parseInt(soalId),
                    point: 100 / parsedSoalIds.length, 
                }));

                await tx.soalPaketSoal.createMany({
                    data: soalPaketData
                });
            }

            return newPaket;
        });

        // --- C. Response Sukses ---
        res.status(201).json({ 
            message: "Paket soal berhasil dibuat!", 
            data: result 
        });

    } catch (error) {
        console.error("Error createPaketSoal:", error);
        
        // PENTING: Hapus file gambar jika database gagal simpan (Rollback manual file)
        if (file && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        res.status(500).json({ 
            message: "Gagal membuat paket soal.", 
            error: error.message 
        });
    }
};