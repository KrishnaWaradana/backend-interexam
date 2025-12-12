// apps/backend/src/controllers/contributor/questionController.js

const prisma = require(global.__basedir + '/config/prismaClient'); 
const { StatusSoal } = require('@prisma/client');
const fs = require('fs'); 
const path = require('path');

// --- HELPER: Function to delete file ---
const deleteFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            console.log(`[FILE] Berhasil menghapus file: ${filePath}`);
        } catch (err) {
            console.error("Failed to delete file:", err);
        }
    }
};

// --- HELPER: Get Contributor ID ---
const getContributorIdFromDB = async () => {
    const contributorUser = await prisma.users.findFirst({
        where: { role: { in: ['Contributor', 'Admin'] } },
        select: { id_user: true }
    });
    if (!contributorUser) throw new Error('Tidak ditemukan user Contributor/Admin di database.');
    return contributorUser.id_user;
};

// =================================================================
// FUNGSI 1: ADD QUESTION (SUDAH DIPERBAIKI SESUAI REQUEST)
// =================================================================
const addQuestion = async (req, res) => {
    // 1. PERBAIKAN PATH: Simpan relative path agar bisa dibaca frontend
    // req.file.destination mengarah ke folder fisik, kita butuh path URL
    // Asumsi folder statis Anda diakses lewat 'uploads/'
    const attachmentPath = req.file 
        ? `uploads/questions/${req.file.filename}` 
        : null;

    try {
        console.log("--- DEBUG ADD QUESTION ---");
        // Cek apakah file terbaca oleh Multer
        if (!req.file) {
            console.log("⚠️ PERINGATAN: Tidak ada file 'image_soal' yang diterima. Cek nama field di frontend.");
        } else {
            console.log("✅ File diterima:", req.file.filename);
        }

        const { 
            tipe_soal, text_soal, id_mata_pelajaran, id_topik, 
            level_kesulitan, pembahasan_umum, opsi_jawaban, action_type 
        } = req.body;

        // 2. VALIDASI WAJIB: ID TOPIK TIDAK BOLEH KOSONG
        if (!id_topik || id_topik === "undefined" || id_topik === "null") {
             throw new Error("ID Topik wajib dipilih dan tidak boleh kosong!");
        }

        const statusSoal = action_type === 'Ajukan' ? StatusSoal.need_verification : StatusSoal.draft;
        
        // Parsing ID
        const topicIdInt = parseInt(id_topik); 
        
        // Cek apakah parsing berhasil (menghindari NaN)
        if (isNaN(topicIdInt)) {
            throw new Error(`ID Topik tidak valid: ${id_topik}`);
        }

        // Ambil ID Contributor
        const contributorId = await getContributorIdFromDB();
        console.log(`[DEBUG] Contributor ID: ${contributorId}, Topic ID: ${topicIdInt}`);

        // Mapping Tipe Soal
        let jenisSoalPrisma = tipe_soal === 'pilihan_ganda' ? 'multiple_choice' : 'multiple_answer';
        if (tipe_soal !== 'pilihan_ganda' && tipe_soal !== 'multi_jawaban') {
             jenisSoalPrisma = tipe_soal; 
        }

        // ⬇️ KONSTRUKSI DATA SOAL ⬇️
        const newSoal = await prisma.soal.create({
            data: {
                tanggal_pembuatan: new Date().toISOString(),
                text_soal: text_soal,
                jenis_soal: jenisSoalPrisma, 
                level_kesulitan: level_kesulitan,
                status: statusSoal,
                contributor: { connect: { id_user: contributorId } },
                topic: { connect: { id_topics: topicIdInt } }, 
            }
        });
        
        // --- SIMPAN GAMBAR SOAL ---
        // Logika ini hanya jalan jika req.file TIDAK null
        if (attachmentPath) {
             console.log("📝 Menyimpan path gambar ke DB:", attachmentPath); // Debugging Log
             await prisma.attachmentsSoal.create({
                data: {
                    path_attachment: attachmentPath, // Simpan path bersih (uploads/questions/abc.jpg)
                    keterangan: 'Gambar Soal Utama',
                    id_soal: newSoal.id_soal
                }
             });
        }

        // --- SIMPAN OPSI JAWABAN ---
        let parsedOpsi = [];
        try {
            parsedOpsi = JSON.parse(opsi_jawaban);
        } catch (e) {
            console.error("Gagal parse opsi jawaban:", e);
        }

        const jawabanData = parsedOpsi.map(opsi => ({
            opsi_jawaban_text: opsi.text, 
            status: opsi.is_correct, 
            pembahasan: pembahasan_umum, 
            soal_id_soal: newSoal.id_soal
        }));
        
        if (jawabanData.length > 0) {
            await prisma.jawabanSoal.createMany({ data: jawabanData });
        }

        const message = action_type === 'Ajukan' ? 'Soal diajukan.' : 'Soal disimpan draft.';
        res.status(201).json({ message: message, data: { soal: newSoal } });

    } catch (error) {
        // Hapus file fisik jika database gagal, tapi gunakan req.file.path (path fisik) untuk unlink
        if (req.file) deleteFile(req.file.path);
        
        console.error('❌ Error addQuestion:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// =================================================================
// FUNGSI 2: GET COMPETENT SUBJECTS (TIDAK BERUBAH)
// =================================================================
const getCompetentSubjects = async (req, res) => {
    let contributorId;
    try {
        contributorId = await getContributorIdFromDB();
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }

    try {
        const competentSubjects = await prisma.kompetensiUser.findMany({
            where: { id_user: contributorId },
            select: { id_subject: true }
        });

        if (competentSubjects.length === 0) {
            return res.status(200).json({ message: 'Contributor belum memiliki kompetensi mata pelajaran.', data: [] });
        }

        const subjectIds = competentSubjects.map(comp => comp.id_subject);
        const subjects = await prisma.topics.findMany({
            where: { id_topics: { in: subjectIds } },
            select: { id_topics: true, nama_topics: true },
            orderBy: { nama_topics: 'asc' }
        });

        res.status(200).json({ message: 'Daftar mata pelajaran berhasil diambil.', data: subjects });

    } catch (error) {
        console.error('Error saat mengambil kompetensi subject:', error);
        res.status(500).json({ message: 'Gagal mengambil data kompetensi dari database.' });
    }
};

// =================================================================
// FUNGSI 3: GET QUESTIONS BY CONTRIBUTOR (TIDAK PERLU DIUBAH)
// =================================================================
const getQuestionsByContributor = async (req, res) => {
    let contributorId;
    try {
        // Menggunakan helper yang sama
        contributorId = await getContributorIdFromDB(); 
        console.log(`[DEBUG READ] Menggunakan Contributor ID: ${contributorId}`);
    } catch (e) {
        return res.status(500).json({ message: 'Error saat mencari ID user di database.' });
    }

    let formattedQuestions = []; 
    let statistics = {};        

    try {
        const totalSoal = await prisma.soal.count({ where: { id_contributor: contributorId } });
        const totalVerified = await prisma.soal.count({ where: { id_contributor: contributorId, status: StatusSoal.disetujui } });
        const totalDraft = await prisma.soal.count({ where: { id_contributor: contributorId, status: StatusSoal.draft } });
        const totalRejected = await prisma.soal.count({ where: { id_contributor: contributorId, status: StatusSoal.ditolak } });
        const totalNeedVerification = await prisma.soal.count({ where: { id_contributor: contributorId, status: StatusSoal.need_verification } });

        statistics = {
            total_dibuat: totalSoal,
            total_tervalidasi: totalVerified,
            total_draft: totalDraft,
            total_ditolak: totalRejected,
            total_need_verification: totalNeedVerification,
            total_belum_diajukan: totalDraft + totalNeedVerification 
        };

        const questions = await prisma.soal.findMany({
            where: { id_contributor: contributorId },
            include: {
                topic: { select: { nama_topics: true } },
                attachments: true // Include ini penting untuk mengambil data gambar
            },
            orderBy: { tanggal_pembuatan: 'desc' }
        });

        // Backend mengirim path string (misal: "uploads/questions/abc.jpg")
        // Frontend bertugas menambahkan base URL (http://localhost...)
        formattedQuestions = questions.map(q => ({
            id: q.id_soal,
            nomor: q.id_soal, 
            mata_pelajaran: q.topic ? q.topic.nama_topics : 'N/A', 
            tipe_soal: q.jenis_soal,
            level_kesulitan: q.level_kesulitan,
            status: q.status,
            id_contributor: q.id_contributor,
            // ⬇️ INI BAGIAN READ FOTO SOAL ⬇️
            gambar: q.attachments.length > 0 ? q.attachments[0].path_attachment : null 
        }));

        res.status(200).json({ 
            message: 'Data dashboard contributor berhasil diambil.', 
            data: formattedQuestions, 
            statistics: statistics
        });

    } catch (error) {
        console.error('Error saat mengambil soal contributor:', error); 
        res.status(500).json({ message: 'Gagal mengambil data soal dari database.' });
    }
};

// =================================================================
// FUNGSI 4: EDIT QUESTION (SUDAH DIPERBAIKI SESUAI REQUEST)
// =================================================================
const editQuestion = async (req, res) => {
    const questionId = parseInt(req.params.id);
    
    // Perbaikan Path
    const attachmentPath = req.file ? `uploads/questions/${req.file.filename}` : null;
    
    // Kita butuh path fisik lama untuk penghapusan file
    let currentPhysicalPath = null; 

    // Destructuring req.body
    const { 
        tipe_soal, text_soal, id_topik, level_kesulitan, 
        pembahasan_umum, opsi_jawaban, action_type, id_mata_pelajaran
    } = req.body;

    const statusSoal = action_type === 'Ajukan' ? StatusSoal.need_verification : StatusSoal.Draft;
    const subjectIdInt = parseInt(id_mata_pelajaran);

    if (!questionId) {
        if (req.file) deleteFile(req.file.path);
        return res.status(400).json({ message: 'ID Soal wajib disertakan.' });
    }

    try {
        const existingSoal = await prisma.soal.findUnique({
            where: { id_soal: questionId },
            include: { attachments: true }
        });

        if (!existingSoal) {
             if (req.file) deleteFile(req.file.path);
             return res.status(404).json({ message: 'Soal tidak ditemukan.' });
        }

        // Ambil path lama dari DB
        const oldDbPath = existingSoal.attachments[0]?.path_attachment || null;

        // Konversi path DB (relative) ke Path Fisik (absolute) untuk dihapus fs.unlink
        if (oldDbPath) {
            // Sesuaikan path join ini dengan struktur folder project Anda
            // Misal: D:\Project\apps\backend\uploads\questions\gambar.jpg
            currentPhysicalPath = path.join(global.__basedir, '../', oldDbPath); 
        }

        // --- HAPUS OPSI JAWABAN LAMA ---
        await prisma.jawabanSoal.deleteMany({
            where: { soal_id_soal: questionId }
        });

        // --- UPDATE ATTACHMENT ---
        if (attachmentPath) {
            // 1. Jika ada gambar baru, hapus gambar lama
            if (currentPhysicalPath) {
                deleteFile(currentPhysicalPath); // Hapus file fisik lama
                
                await prisma.attachmentsSoal.deleteMany({ // Hapus record lama di DB
                    where: { id_soal: questionId }
                });
            }

            // 2. Buat record baru
            await prisma.attachmentsSoal.create({
                data: {
                    path_attachment: attachmentPath, // Path baru
                    keterangan: 'Gambar Soal Utama',
                    id_soal: questionId
                }
            });
        }

        // --- UPDATE DATA SOAL UTAMA ---
        const updatedSoal = await prisma.soal.update({
            where: { id_soal: questionId },
            data: {
                text_soal: text_soal,
                jenis_soal: tipe_soal === 'pilihan_ganda' ? 'multiple_choice' : (tipe_soal === 'multi_jawaban' ? 'multiple_answer' : tipe_soal),
                level_kesulitan: level_kesulitan,
                status: statusSoal,
                id_topics: parseInt(id_topik), // Pastikan update topik juga
            }
        });

        // --- BUAT OPSI JAWABAN BARU ---
        const parsedOpsi = JSON.parse(opsi_jawaban);
        const jawabanData = parsedOpsi.map(opsi => ({
            opsi_jawaban_text: opsi.text, 
            status: opsi.is_correct, 
            pembahasan: pembahasan_umum, 
            soal_id_soal: questionId
        }));
        await prisma.jawabanSoal.createMany({ data: jawabanData });

        res.status(200).json({ message: 'Soal berhasil diperbarui.', data: updatedSoal });

    } catch (error) {
        // Hapus file baru yg barusan diupload jika proses DB gagal
        if (req.file) deleteFile(req.file.path);
        console.error('Error editQuestion:', error);
        res.status(500).json({ message: 'Gagal memperbarui soal.' });
    }
};

// =================================================================
// FUNGSI 5: DELETE QUESTION (DISESUAIKAN PATH LOGICNYA AGAR TIDAK ERROR)
// =================================================================
const deleteQuestion = async (req, res) => {
    const questionId = parseInt(req.params.id);

    try {
        const contributorId = await getContributorIdFromDB(); // Cek akses (opsional)

        const existingSoal = await prisma.soal.findUnique({
            where: { id_soal: questionId },
            include: { attachments: true }
        });

        if (!existingSoal) {
            return res.status(404).json({ message: 'Soal tidak ditemukan.' });
        }

        // --- 1. HAPUS FILE GAMBAR DARI DISK ---
        if (existingSoal.attachments && existingSoal.attachments.length > 0) {
            const relativePath = existingSoal.attachments[0]?.path_attachment;
            if (relativePath) {
                // PENTING: Gunakan logic path yang sama dengan editQuestion agar file ketemu
                const physicalPath = path.join(global.__basedir, '../', relativePath);
                deleteFile(physicalPath); 
            }
        }

        // --- 2. HAPUS DATA DATABASE ---
        await prisma.attachmentsSoal.deleteMany({ where: { id_soal: questionId } });
        await prisma.jawabanSoal.deleteMany({ where: { soal_id_soal: questionId } });
        await prisma.soal.delete({ where: { id_soal: questionId } });

        res.status(200).json({ 
            message: `Soal ID ${questionId} berhasil dihapus.`, 
            deletedId: questionId
        });

    } catch (error) {
        console.error('Error saat menghapus soal:', error);
        res.status(500).json({ message: 'Gagal menghapus soal.' });
    }
};

// EKSPOR SEMUA MODULE
module.exports = { 
    addQuestion, 
    getQuestionsByContributor,
    editQuestion,
    deleteQuestion,
    getCompetentSubjects
};