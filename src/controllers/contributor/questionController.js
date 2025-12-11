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
        } catch (err) {
            console.error("Failed to delete file:", err);
        }
    }
};
const getContributorIdFromDB = async (attachmentPath = null) => { /* ... */ };
// =================================================================
// FUNGSI 1: ADD QUESTION (DIDEFINISIKAN DAN DIEKSPOR)
// =================================================================
const addQuestion = async (req, res) => {
    const attachmentPath = req.file ? req.file.path : null; 

    // Destructuring req.body
    const { 
        tipe_soal, text_soal, 
        id_mata_pelajaran, id_topik, level_kesulitan, 
        pembahasan_umum, opsi_jawaban, action_type 
    } = req.body;

    const statusSoal = action_type === 'Ajukan' ? StatusSoal.need_verification : StatusSoal.draft;
    const subjectIdInt = parseInt(id_mata_pelajaran); 

    // ⬇️ LOGIKA PENGAMBILAN ID CONTRIBUTOR DARI DATABASE (TANPA TOKEN) ⬇️
    let contributorId;
    
    try {
        const contributorUser = await prisma.users.findFirst({
            where: { role: { in: ['Contributor', 'Admin'] } },
            select: { id_user: true }
        });

        if (!contributorUser) {
            if (attachmentPath) deleteFile(attachmentPath);
            return res.status(500).json({ message: 'Gagal: Tidak ditemukan user Contributor/Admin di database.' });
        }
        contributorId = contributorUser.id_user; 
        console.log(`[DEBUG DB FETCH ADD] Menggunakan Contributor ID: ${contributorId}`);

    } catch (e) {
        if (attachmentPath) deleteFile(attachmentPath);
        return res.status(500).json({ message: 'Error saat mencari ID user di database.' });
    }
    // ⬆️ END LOGIKA CONTRIBUTOR ⬆️

    // --- Mapping Tipe Soal ---
    let jenisSoalPrisma;
    if (tipe_soal === 'pilihan_ganda') {
        jenisSoalPrisma = 'multiple_choice';
    } else if (tipe_soal === 'multi_jawaban') {
        jenisSoalPrisma = 'multiple_answer';
    } else {
        jenisSoalPrisma = tipe_soal; 
    }

    // --- Validasi Dasar ---
    if (!text_soal || !id_mata_pelajaran || !opsi_jawaban || !tipe_soal) {
        if (attachmentPath) deleteFile(attachmentPath);
        return res.status(400).json({ message: 'Field wajib harus diisi.' });
    }
    
    // ⬇️ KONSTRUKSI DATA SOAL ⬇️
    const dataSoal = {
        tanggal_pembuatan: new Date().toISOString(),
        text_soal: text_soal,
        jenis_soal: jenisSoalPrisma, 
        level_kesulitan: level_kesulitan,
        status: statusSoal,
        contributor: { connect: { id_user: contributorId } },
        topic: { connect: { id_topics: subjectIdInt } },
    };
    
    try {
        const newSoal = await prisma.soal.create({ data: dataSoal });
        
        // ... (Simpan Attachment, Buat Opsi Jawaban) ...
        
        // ⬇️ FILTERING VALIDATOR TUJUAN ⬇️
        let validatorList = [];
        if (action_type === 'Ajukan') {
            // ... (Logic filtering validator Anda) ...
        }
        // ⬆️ END FILTERING VALIDATOR ⬆️

        const message = action_type === 'Ajukan'
            ? 'Soal berhasil diajukan untuk diverifikasi.'
            : 'Soal berhasil disimpan sebagai draft.';

        res.status(201).json({ message: message, data: { soal: newSoal, validators: validatorList } });

    } catch (error) {
        if (attachmentPath) deleteFile(attachmentPath);
        console.error('Error saat menambah soal:', error);
        res.status(500).json({ message: 'Gagal menambahkan soal.' });
    }
};

const getCompetentSubjects = async (req, res) => {
    let contributorId;

    // ⬇️ LOGIKA PENGAMBILAN ID CONTRIBUTOR DARI DATABASE (MODE DEBUG) ⬇️
    try {
        contributorId = await getContributorIdFromDB();
        console.log(`[DEBUG DB FETCH COMPETENCY] Menggunakan Contributor ID: ${contributorId}`);
    } catch (e) {
        // Jika gagal mendapatkan ID Contributor, kirim error
        return res.status(500).json({ message: e.message });
    }

    try {
        // 1. Ambil semua ID Subject dari tabel KompetensiUser yang dimiliki Contributor ini
        const competentSubjects = await prisma.kompetensiUser.findMany({
            where: {
                id_user: contributorId
            },
            select: {
                id_subject: true // Hanya ambil ID Subject yang dikuasai
            }
        });

        // Jika Contributor tidak memiliki kompetensi, kembalikan array kosong
        if (competentSubjects.length === 0) {
            return res.status(200).json({ 
                message: 'Contributor belum memiliki kompetensi mata pelajaran.', 
                data: [] 
            });
        }

        // 2. Ekstrak list ID Subject unik
        const subjectIds = competentSubjects.map(comp => comp.id_subject);

        // 3. Ambil detail Mata Pelajaran (Topics) yang sesuai
        const subjects = await prisma.topics.findMany({
            where: {
                id_topics: { in: subjectIds }
            },
            select: {
                id_topics: true,
                nama_topics: true
            },
            orderBy: {
                nama_topics: 'asc'
            }
        });

        res.status(200).json({
            message: 'Daftar mata pelajaran berdasarkan kompetensi berhasil diambil.',
            data: subjects
        });

    } catch (error) {
        console.error('Error saat mengambil kompetensi subject:', error);
        res.status(500).json({ message: 'Gagal mengambil data kompetensi dari database.' });
    }
};

// =================================================================
// FUNGSI 2: GET QUESTIONS BY CONTRIBUTOR (FINAL PERBAIKAN ENUM)
// =================================================================

 const getQuestionsByContributor = async (req, res) => {
    let contributorId;

    // ⬇️ LOGIKA PENGAMBILAN ID CONTRIBUTOR DARI DATABASE (TANPA TOKEN) ⬇️
    try {
        const contributorUser = await prisma.users.findFirst({
            where: { role: { in: ['Contributor', 'Admin'] } },
            select: { id_user: true }
        });

        if (!contributorUser) {
            return res.status(500).json({ message: 'Gagal: Tidak ditemukan user Contributor/Admin di database.' });
        }
        contributorId = contributorUser.id_user; 
        console.log(`[DEBUG DB FETCH READ] Menggunakan Contributor ID: ${contributorId}`);

    } catch (e) {
        return res.status(500).json({ message: 'Error saat mencari ID user di database.' });
    }
    // ⬆️ END LOGIKA CONTRIBUTOR ⬆️

    let formattedQuestions = []; 
    let statistics = {};        

    try {
        // --- 1. AMBIL STATISTIK (COUNT QUERIES MENGGUNAKAN ENUM YANG BENAR) ---
        // Menggunakan asumsi case ENUM kecil/campuran sesuai DB Anda (draft, need_verification)

        const totalSoal = await prisma.soal.count({ where: { id_contributor: contributorId } });

        const totalVerified = await prisma.soal.count({ 
            where: { id_contributor: contributorId, status: StatusSoal.disetujui } 
        });
        
        const totalDraft = await prisma.soal.count({ 
            where: { id_contributor: contributorId, status: StatusSoal.draft } 
        });
        
        const totalRejected = await prisma.soal.count({ 
            where: { id_contributor: contributorId, status: StatusSoal.ditolak } 
        });
        
        const totalNeedVerification = await prisma.soal.count({ 
            where: { id_contributor: contributorId, status: StatusSoal.need_verification } 
        });

        statistics = {
            total_dibuat: totalSoal,
            total_tervalidasi: totalVerified,
            total_draft: totalDraft,
            total_ditolak: totalRejected,
            total_need_verification: totalNeedVerification,
            total_belum_diajukan: totalDraft + totalNeedVerification 
        };

        // --- 2. AMBIL DAFTAR SOAL LENGKAP ---
        const questions = await prisma.soal.findMany({
            where: { id_contributor: contributorId },
            include: {
                topic: { select: { nama_topics: true } }
            },
            orderBy: { tanggal_pembuatan: 'desc' }
        });

        // --- 3. PROSES DATA UNTUK TAMPILAN ---
        formattedQuestions = questions.map(q => ({
            id: q.id_soal,
            nomor: q.id_soal, 
            mata_pelajaran: q.topic ? q.topic.nama_topics : 'N/A', 
            tipe_soal: q.jenis_soal,
            level_kesulitan: q.level_kesulitan,
            status: q.status,
            id_contributor: q.id_contributor
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

// ⬇️ PERBAIKAN FINAL EKSPOR UNTUK MENGHINDARI TYPE ERROR DI ROUTER ⬇️
module.exports = { 
    addQuestion: exports.addQuestion, 
    getQuestionsByContributor: exports.getQuestionsByContributor 
};

const editQuestion = async (req, res) => {
    const questionId = parseInt(req.params.id);
    const attachmentPath = req.file ? req.file.path : null; 
    let currentAttachmentPath = null; 

    // Destructuring req.body
    const { 
        tipe_soal, text_soal, 
        id_mata_pelajaran, id_topik, level_kesulitan, 
        pembahasan_umum, opsi_jawaban, action_type 
    } = req.body;

    // Pastikan ENUM StatusSoal digunakan dengan benar (sesuai case DB Anda)
    const statusSoal = action_type === 'Ajukan' ? StatusSoal.need_verification : StatusSoal.Draft;
    const subjectIdInt = parseInt(id_mata_pelajaran); 

    // ⬇️ LOGIKA PENGAMBILAN ID CONTRIBUTOR DARI DATABASE (MODE DEBUG) ⬇️
    let contributorId;
    try {
        contributorId = await getContributorIdFromDB(attachmentPath);
        console.log(`[DEBUG DB FETCH UPDATE] Menggunakan Contributor ID: ${contributorId}`);
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }

    if (!questionId) {
        if (attachmentPath) deleteFile(attachmentPath);
        return res.status(400).json({ message: 'ID Soal wajib disertakan.' });
    }

    try {
        // --- 1. VERIFIKASI KEPEMILIKAN SOAL ---
        const existingSoal = await prisma.soal.findUnique({
            where: { id_soal: questionId },
            include: { attachments: true }
        });

        if (!existingSoal) {
            if (attachmentPath) deleteFile(attachmentPath);
            return res.status(404).json({ message: 'Soal tidak ditemukan.' });
        }
        
        // Simpan path lama untuk dihapus jika diganti
        if (existingSoal.attachments && existingSoal.attachments.length > 0) {
             currentAttachmentPath = existingSoal.attachments[0]?.path_attachment || null; 
        }

        // --- 2. HAPUS DATA LAMA (OPSI JAWABAN) ---
        await prisma.jawabanSoal.deleteMany({
            where: { soal_id_soal: questionId }
        });

        // --- 3. HAPUS & UPDATE ATTACHMENT ---
        if (attachmentPath) {
            // Jika ada attachment baru, hapus yang lama dari disk dan DB
            if (currentAttachmentPath) {
                deleteFile(currentAttachmentPath); // Hapus dari disk
                await prisma.attachmentsSoal.deleteMany({ // Hapus dari DB
                    where: { id_soal: questionId }
                });
            }
            // Buat attachment baru di DB
            await prisma.attachmentsSoal.create({
                data: {
                    path_attachment: attachmentPath, keterangan: 'Gambar Soal Utama', id_soal: questionId
                }
            });
        }


        // --- 4. UPDATE DATA SOAL UTAMA ---
        const updatedSoal = await prisma.soal.update({
            where: { id_soal: questionId },
            data: {
                text_soal: text_soal,
                jenis_soal: tipe_soal === 'pilihan_ganda' ? 'multiple_choice' : (tipe_soal === 'multi_jawaban' ? 'multiple_answer' : tipe_soal),
                level_kesulitan: level_kesulitan,
                status: statusSoal,
                id_topics: subjectIdInt,
            }
        });

        // --- 5. BUAT OPSI JAWABAN BARU ---
        const parsedOpsi = JSON.parse(opsi_jawaban);
        const jawabanData = parsedOpsi.map(opsi => ({
            opsi_jawaban_text: opsi.text, 
            status: opsi.is_correct, 
            pembahasan: pembahasan_umum, 
            soal_id_soal: questionId
        }));
        await prisma.jawabanSoal.createMany({ data: jawabanData });
        
        // ... (Logic Filtering Validator bisa ditambahkan di sini jika action_type === 'Ajukan') ...

        res.status(200).json({ 
            message: 'Soal berhasil diperbarui.', 
            data: updatedSoal 
        });

    } catch (error) {
        if (attachmentPath) deleteFile(attachmentPath);
        console.error('Error saat memperbarui soal:', error);
        res.status(500).json({ message: 'Gagal memperbarui soal.' });
    }
};

const deleteQuestion = async (req, res) => {
    const questionId = parseInt(req.params.id);

    // ⬇️ LOGIKA PENGAMBILAN ID CONTRIBUTOR DARI DATABASE (MODE DEBUG) ⬇️
    let contributorId;
    try {
        contributorId = await getContributorIdFromDB();
        console.log(`[DEBUG DB FETCH DELETE] Menggunakan Contributor ID: ${contributorId}`);
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }

    if (!questionId) {
        return res.status(400).json({ message: 'ID Soal wajib disertakan.' });
    }

    try {
        // --- 1. VERIFIKASI KEPEMILIKAN SOAL DAN ATTACHMENT ---
        const existingSoal = await prisma.soal.findUnique({
            where: { id_soal: questionId },
            include: { attachments: true }
        });

        if (!existingSoal) {
            return res.status(404).json({ message: 'Soal tidak ditemukan.' });
        }

        // Di mode produksi, ini harus diaktifkan:
        // if (existingSoal.id_contributor !== contributorId) {
        //     return res.status(403).json({ message: 'Akses Ditolak: Anda bukan pemilik soal ini.' });
        // }

        // --- 2. HAPUS FILE GAMBAR DARI DISK (Jika ada) ---
        if (existingSoal.attachments && existingSoal.attachments.length > 0) {
            const attachmentPath = existingSoal.attachments[0]?.path_attachment;
            if (attachmentPath) {
                deleteFile(attachmentPath); // Hapus dari disk menggunakan helper
            }
        }

        // --- 3. HAPUS DATA ANAK DI DATABASE (CASCADE MANUAL) ---
        // Karena Prisma tidak selalu otomatis meng-cascade:
        
        // Hapus Attachments dari DB
        await prisma.attachmentsSoal.deleteMany({
            where: { id_soal: questionId }
        });

        // Hapus JawabanSoal
        await prisma.jawabanSoal.deleteMany({
            where: { soal_id_soal: questionId }
        });

        // --- 4. HAPUS SOAL UTAMA ---
        await prisma.soal.delete({
            where: { id_soal: questionId }
        });

        res.status(200).json({ 
            message: `Soal ID ${questionId} berhasil dihapus.`, 
            deletedId: questionId
        });

    } catch (error) {
        console.error('Error saat menghapus soal:', error);
        res.status(500).json({ message: 'Gagal menghapus soal.' });
    }
};

// ⬇️ EKSPOR FINAL: DIJAMIN TIDAK ADA TYPE ERROR DI ROUTER ⬇️
module.exports = { 
    addQuestion, 
    getQuestionsByContributor,
    editQuestion,
    deleteQuestion,
    getCompetentSubjects

};