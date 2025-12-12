// apps/backend/src/controllers/contributor/questionController.js

const prisma = require(global.__basedir + '/config/prismaClient');
const { StatusSoal } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// --- HELPER: Function to delete file Robust ---
const deleteFile = (filePath) => {
    if (!filePath) return;
    // Pastikan path absolut
    const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(global.__basedir, '../', filePath);

    if (fs.existsSync(absolutePath)) {
        try {
            fs.unlinkSync(absolutePath);
            console.log(`[FILE] Berhasil menghapus file: ${absolutePath}`);
        } catch (err) {
            console.error(`[FILE] Gagal menghapus file ${absolutePath}:`, err.message);
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
// FUNGSI 1: ADD QUESTION (MULTI UPLOAD)
// =================================================================
const addQuestion = async (req, res) => {
    // 1. AKSES FILE DARI req.files
    const files = req.files || {};
    
    // Ambil file soal utama
    const soalFile = files['image_soal'] ? files['image_soal'][0] : null;
    // Path folder disatukan ke 'questions' sesuai request Anda
    const dbSoalPath = soalFile ? `uploads/questions/${soalFile.filename}` : null;

    // Ambil list file jawaban
    const answerFilesList = files['image_jawaban'] || [];

    try {
        console.log("--- DEBUG ADD QUESTION ---");
        if (soalFile) console.log("✅ Gambar Soal:", soalFile.filename);
        if (answerFilesList.length > 0) console.log(`✅ ${answerFilesList.length} Gambar Jawaban diterima.`);

        const { 
            tipe_soal, text_soal, id_topik, level_kesulitan, 
            pembahasan_umum, opsi_jawaban, action_type 
        } = req.body;

        if (!id_topik || id_topik === "undefined" || id_topik === "null") {
             throw new Error("ID Topik wajib dipilih!");
        }
        const topicIdInt = parseInt(id_topik);
        if (isNaN(topicIdInt)) throw new Error("ID Topik tidak valid");

        const contributorId = await getContributorIdFromDB();
        const statusSoal = action_type === 'Ajukan' ? StatusSoal.need_verification : StatusSoal.draft;

        let jenisSoalPrisma = tipe_soal === 'pilihan_ganda' ? 'multiple_choice' : 'multiple_answer';
        if (tipe_soal !== 'pilihan_ganda' && tipe_soal !== 'multi_jawaban') jenisSoalPrisma = tipe_soal;

        // ⬇️ CREATE SOAL ⬇️
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
        
        // ⬇️ SIMPAN GAMBAR SOAL ⬇️
        if (dbSoalPath) {
             await prisma.attachmentsSoal.create({
                data: {
                    path_attachment: dbSoalPath,
                    keterangan: 'Gambar Soal Utama',
                    id_soal: newSoal.id_soal
                }
             });
        }

        // ⬇️ MAPPING GAMBAR JAWABAN ⬇️
        let parsedOpsi = [];
        try {
            parsedOpsi = JSON.parse(opsi_jawaban);
        } catch (e) {
            throw new Error("Format JSON opsi_jawaban tidak valid.");
        }

        let answerFileIndex = 0;

        const jawabanData = parsedOpsi.map((opsi) => {
            let currentAnswerImagePath = null;

            // Jika frontend kirim flag has_image: true, ambil file dari antrian
            if (opsi.has_image === true && answerFilesList[answerFileIndex]) {
                const file = answerFilesList[answerFileIndex];
                // Simpan ke folder questions juga
                currentAnswerImagePath = `uploads/questions/${file.filename}`;
                answerFileIndex++;
            }

            return {
                opsi_jawaban_text: opsi.text || "", 
                status: opsi.is_correct || false,
                pembahasan: pembahasan_umum,
                soal_id_soal: newSoal.id_soal,
                path_gambar_jawaban: currentAnswerImagePath 
            };
        });
        
        if (jawabanData.length > 0) {
            await prisma.jawabanSoal.createMany({ data: jawabanData });
        }

        const message = action_type === 'Ajukan' ? 'Soal diajukan.' : 'Soal disimpan draft.';
        res.status(201).json({ message: message, data: { soalId: newSoal.id_soal } });

    } catch (error) {
        // Cleanup files jika error
        if (soalFile) deleteFile(soalFile.path);
        if (answerFilesList.length > 0) answerFilesList.forEach(f => deleteFile(f.path));
        
        console.error('❌ Error addQuestion:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// =================================================================
// FUNGSI 2: GET QUESTIONS (DASHBOARD)
// =================================================================
const getQuestionsByContributor = async (req, res) => {
    let contributorId;
    try {
        contributorId = await getContributorIdFromDB(); 
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }

    try {
        const totalSoal = await prisma.soal.count({ where: { id_contributor: contributorId } });
        const totalVerified = await prisma.soal.count({ where: { id_contributor: contributorId, status: StatusSoal.disetujui } });
        const totalDraft = await prisma.soal.count({ where: { id_contributor: contributorId, status: StatusSoal.draft } });
        const totalRejected = await prisma.soal.count({ where: { id_contributor: contributorId, status: StatusSoal.ditolak } });
        const totalNeedVerification = await prisma.soal.count({ where: { id_contributor: contributorId, status: StatusSoal.need_verification } });

        const statistics = {
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
                attachments: true 
            },
            orderBy: { tanggal_pembuatan: 'desc' }
        });

        const formattedQuestions = questions.map(q => ({
            id: q.id_soal,
            nomor: q.id_soal, 
            mata_pelajaran: q.topic ? q.topic.nama_topics : 'N/A', 
            tipe_soal: q.jenis_soal,
            level_kesulitan: q.level_kesulitan,
            status: q.status,
            id_contributor: q.id_contributor,
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
// FUNGSI 3: EDIT QUESTION (FIXED RELATION NAME)
// =================================================================
const editQuestion = async (req, res) => {
    const questionId = parseInt(req.params.id);
    if (!questionId) return res.status(400).json({ message: 'ID Soal wajib disertakan.' });

    // Akses File
    const files = req.files || {};
    const newSoalFile = files['image_soal'] ? files['image_soal'][0] : null;
    const dbNewSoalPath = newSoalFile ? `uploads/questions/${newSoalFile.filename}` : null;
    const newAnswerFilesList = files['image_jawaban'] || [];

    try {
        const existingSoal = await prisma.soal.findUnique({
            where: { id_soal: questionId },
            include: { 
                attachments: true, 
                jawaban: true // <--- PERBAIKAN: Gunakan 'jawaban' sesuai schema
            }
        });

        if (!existingSoal) throw new Error('Soal tidak ditemukan.');

        // A. UPDATE GAMBAR SOAL UTAMA
        if (dbNewSoalPath) {
            if (existingSoal.attachments && existingSoal.attachments.length > 0) {
                deleteFile(existingSoal.attachments[0].path_attachment);
                await prisma.attachmentsSoal.deleteMany({ where: { id_soal: questionId } });
            }
            await prisma.attachmentsSoal.create({
                data: { path_attachment: dbNewSoalPath, keterangan: 'Gambar Soal Utama', id_soal: questionId }
            });
        }

        // B. UPDATE DATA SOAL
        const { tipe_soal, text_soal, id_topik, level_kesulitan, pembahasan_umum, opsi_jawaban, action_type } = req.body;
        const statusSoal = action_type === 'Ajukan' ? StatusSoal.need_verification : StatusSoal.Draft;
        
        await prisma.soal.update({
            where: { id_soal: questionId },
            data: {
                text_soal, level_kesulitan, status: statusSoal,
                jenis_soal: tipe_soal === 'pilihan_ganda' ? 'multiple_choice' : (tipe_soal === 'multi_jawaban' ? 'multiple_answer' : tipe_soal),
                id_topics: parseInt(id_topik),
            }
        });

        // C. UPDATE JAWABAN (Hapus Semua -> Buat Baru)
        // Gunakan 'existingSoal.jawaban' bukan 'existingSoal.jawabanSoal'
        if (existingSoal.jawaban) {
            existingSoal.jawaban.forEach(jawabanLama => {
                // Periksa path_gambar_jawaban (sesuai update schema terakhir)
                if (jawabanLama.path_gambar_jawaban) {
                    deleteFile(jawabanLama.path_gambar_jawaban);
                }
            });
        }
        
        // Hapus record di tabel JawabanSoal
        await prisma.jawabanSoal.deleteMany({ where: { soal_id_soal: questionId } });

        const parsedOpsi = JSON.parse(opsi_jawaban);
        let answerFileIndex = 0;
        const jawabanDataBaru = parsedOpsi.map((opsi) => {
            let currentAnswerImagePath = null;
            if (opsi.has_image === true && newAnswerFilesList[answerFileIndex]) {
                 const file = newAnswerFilesList[answerFileIndex];
                 currentAnswerImagePath = `uploads/questions/${file.filename}`;
                 answerFileIndex++;
            }
            return {
                opsi_jawaban_text: opsi.text || "",
                status: opsi.is_correct,
                pembahasan: pembahasan_umum,
                soal_id_soal: questionId,
                path_gambar_jawaban: currentAnswerImagePath
            };
        });

        await prisma.jawabanSoal.createMany({ data: jawabanDataBaru });

        res.status(200).json({ message: 'Soal berhasil diperbarui.' });

    } catch (error) {
        if (newSoalFile) deleteFile(newSoalFile.path);
        if (newAnswerFilesList.length > 0) newAnswerFilesList.forEach(f => deleteFile(f.path));
        console.error('Error editQuestion:', error.message);
        res.status(500).json({ message: error.message || 'Gagal memperbarui soal.' });
    }
};
// =================================================================
// FUNGSI 4: DELETE QUESTION (FIXED RELATION NAME)
// =================================================================
const deleteQuestion = async (req, res) => {
    const questionId = parseInt(req.params.id);

    try {
        const existingSoal = await prisma.soal.findUnique({
            where: { id_soal: questionId },
            include: { 
                attachments: true, 
                jawaban: true // <--- PERBAIKAN: Gunakan 'jawaban'
            } 
        });

        if (!existingSoal) return res.status(404).json({ message: 'Soal tidak ditemukan.' });

        // Hapus Gambar Soal
        if (existingSoal.attachments && existingSoal.attachments.length > 0) {
            deleteFile(existingSoal.attachments[0].path_attachment);
        }

        // Hapus Gambar Jawaban
        // Gunakan existingSoal.jawaban
        if (existingSoal.jawaban && existingSoal.jawaban.length > 0) {
             existingSoal.jawaban.forEach(item => {
                 if (item.path_gambar_jawaban) {
                      deleteFile(item.path_gambar_jawaban);
                 }
             });
        }

        // DB Clean Up
        await prisma.attachmentsSoal.deleteMany({ where: { id_soal: questionId } });
        await prisma.jawabanSoal.deleteMany({ where: { soal_id_soal: questionId } });
        await prisma.soal.delete({ where: { id_soal: questionId } });

        res.status(200).json({ message: `Soal ID ${questionId} berhasil dihapus.` });

    } catch (error) {
        console.error('Error saat menghapus soal:', error);
        res.status(500).json({ message: 'Gagal menghapus soal.' });
    }
};

// =================================================================
// FUNGSI 5: GET COMPETENT SUBJECTS
// =================================================================
const getCompetentSubjects = async (req, res) => {
    try {
        const contributorId = await getContributorIdFromDB();

        const competentSubjects = await prisma.kompetensiUser.findMany({
            where: { id_user: contributorId },
            select: { id_subject: true }
        });

        if (competentSubjects.length === 0) {
            return res.status(200).json({ message: 'Contributor belum memiliki kompetensi.', data: [] });
        }

        const subjectIds = competentSubjects.map(comp => comp.id_subject);
        const subjects = await prisma.topics.findMany({
            where: { id_topics: { in: subjectIds } },
            select: { id_topics: true, nama_topics: true },
            orderBy: { nama_topics: 'asc' }
        });

        res.status(200).json({ message: 'Sukses', data: subjects });

    } catch (error) {
        console.error('Error competent subjects:', error);
        res.status(500).json({ message: 'Gagal mengambil data kompetensi.' });
    }
};

// =================================================================
// EKSPOR MODUL (SANGAT PENTING AGAR ROUTER TIDAK CRASH)
// =================================================================
module.exports = { 
    addQuestion, 
    getQuestionsByContributor,
    editQuestion,
    deleteQuestion,
    getCompetentSubjects // Pastikan ini ada!
};