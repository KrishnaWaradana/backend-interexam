const prisma = require(global.__basedir + '/config/prismaClient');
const { StatusSoal } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// --- HELPER: Delete File ---
const deleteFile = (filePath) => {
    if (!filePath) return;
    const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(global.__basedir, '../', filePath);

    if (fs.existsSync(absolutePath)) {
        try {
            fs.unlinkSync(absolutePath);
        } catch (err) {
            console.error(`Gagal hapus file: ${err.message}`);
        }
    }
};

// --- HELPER: Get ID ---
const getContributorIdFromDB = async () => {
    const user = await prisma.users.findFirst({
        where: { role: { in: ['Contributor', 'Admin'] } },
        select: { id_user: true }
    });
    if (!user) throw new Error('User Contributor tidak ditemukan.');
    return user.id_user;
};

// =================================================================
// 1. ADD QUESTION
// =================================================================
const addQuestion = async (req, res) => {
    const files = req.files || {};
    const soalFile = files['image_soal'] ? files['image_soal'][0] : null;
    const dbSoalPath = soalFile ? `uploads/questions/${soalFile.filename}` : null;
    const answerFilesList = files['image_jawaban'] || [];

    try {
        const { tipe_soal, text_soal, id_topik, level_kesulitan, pembahasan_umum, opsi_jawaban, action_type } = req.body;

        if (!id_topik || id_topik === "undefined") throw new Error("Topik wajib dipilih!");
        
        const contributorId = await getContributorIdFromDB();
        const statusSoal = action_type === 'Ajukan' ? StatusSoal.need_verification : StatusSoal.draft;
        
        // Mapping Tipe Soal
        let jenis = tipe_soal;
        if(tipe_soal === 'pilihan_ganda') jenis = 'multiple_choice';
        if(tipe_soal === 'multi_jawaban') jenis = 'multiple_answer';

        // Simpan Soal
        const newSoal = await prisma.soal.create({
            data: {
                tanggal_pembuatan: new Date().toISOString(),
                text_soal: text_soal,
                jenis_soal: jenis, 
                level_kesulitan: level_kesulitan,
                status: statusSoal,
                contributor: { connect: { id_user: contributorId } },
                topic: { connect: { id_topics: parseInt(id_topik) } }, 
            }
        });
        
        // Simpan Gambar Soal
        if (dbSoalPath) {
             await prisma.attachmentsSoal.create({
                data: { path_attachment: dbSoalPath, keterangan: 'Gambar Soal', id_soal: newSoal.id_soal }
             });
        }

        // Simpan Jawaban
        let parsedOpsi = JSON.parse(opsi_jawaban);
        let answerFileIndex = 0;
        
        const jawabanData = parsedOpsi.map((opsi) => {
            let imgPath = null;
            if (opsi.has_image === true && answerFilesList[answerFileIndex]) {
                imgPath = `uploads/questions/${answerFilesList[answerFileIndex].filename}`;
                answerFileIndex++;
            }
            return {
                opsi_jawaban_text: opsi.text || "", 
                status: opsi.is_correct || false,
                pembahasan: pembahasan_umum,
                soal_id_soal: newSoal.id_soal,
                path_gambar_jawaban: imgPath 
            };
        });
        
        if (jawabanData.length > 0) {
            await prisma.jawabanSoal.createMany({ data: jawabanData });
        }

        res.status(201).json({ message: 'Soal berhasil disimpan.', data: { soalId: newSoal.id_soal } });

    } catch (error) {
        if (soalFile) deleteFile(soalFile.path);
        if (answerFilesList.length > 0) answerFilesList.forEach(f => deleteFile(f.path));
        res.status(500).json({ message: error.message });
    }
};

// =================================================================
// 2. GET QUESTIONS (LIST DASHBOARD & EDIT)
// =================================================================
const getQuestionsByContributor = async (req, res) => {
    try {
        const contributorId = await getContributorIdFromDB(); 
        
        // Statistik (Sederhana)
        const totalSoal = await prisma.soal.count({ where: { id_contributor: contributorId } });
        const totalVerified = await prisma.soal.count({ where: { id_contributor: contributorId, status: StatusSoal.disetujui } });
        const totalDraft = await prisma.soal.count({ where: { id_contributor: contributorId, status: StatusSoal.draft } });
        const totalRejected = await prisma.soal.count({ where: { id_contributor: contributorId, status: StatusSoal.ditolak } });
        const totalNeed = await prisma.soal.count({ where: { id_contributor: contributorId, status: StatusSoal.need_verification } });

        const questions = await prisma.soal.findMany({
            where: { id_contributor: contributorId },
            include: {
                topic: { select: { nama_topics: true } },
                attachments: true,
                jawaban: true 
            },
            orderBy: { tanggal_pembuatan: 'desc' }
        });

        const formattedQuestions = questions.map(q => ({
            id: q.id_soal,
            nomor: q.id_soal, 
            mata_pelajaran: q.topic ? q.topic.nama_topics : 'N/A', 
            text_soal: q.text_soal, // Pastikan ini terkirim!
            tipe_soal: q.jenis_soal,
            level_kesulitan: q.level_kesulitan,
            status: q.status,
            id_contributor: q.id_contributor,
            id_topik: q.id_topics,
            pembahasan_umum: q.jawaban.length > 0 ? q.jawaban[0].pembahasan : "",
            catatan_revisi: null, 
            gambar: q.attachments.length > 0 ? q.attachments[0].path_attachment : null,
            list_jawaban: q.jawaban 
        }));

        res.status(200).json({ 
            message: 'Berhasil', 
            data: formattedQuestions, 
            statistics: {
                total_dibuat: totalSoal, total_tervalidasi: totalVerified, 
                total_draft: totalDraft, total_ditolak: totalRejected, 
                total_need_verification: totalNeed
            }
        });

    } catch (error) {
        console.error(error); 
        res.status(500).json({ message: 'Gagal mengambil data.' });
    }
};

// =================================================================
// 3. EDIT QUESTION (INI YANG PALING PENTING DIPERBAIKI)
// =================================================================
const editQuestion = async (req, res) => {
    const questionId = parseInt(req.params.id);
    const files = req.files || {};
    const newSoalFile = files['image_soal'] ? files['image_soal'][0] : null;
    const newAnswerFilesList = files['image_jawaban'] || [];

    try {
        const existingSoal = await prisma.soal.findUnique({
            where: { id_soal: questionId },
            include: { attachments: true, jawaban: true }
        });
        if (!existingSoal) throw new Error('Soal tidak ditemukan.');

        // A. UPDATE GAMBAR SOAL UTAMA
        // Jika ada file baru -> Hapus lama, Simpan baru
        if (newSoalFile) {
            const finalSoalPath = `uploads/questions/${newSoalFile.filename}`;
            if (existingSoal.attachments.length > 0) {
                deleteFile(existingSoal.attachments[0].path_attachment);
                await prisma.attachmentsSoal.deleteMany({ where: { id_soal: questionId } });
            }
            await prisma.attachmentsSoal.create({
                data: { path_attachment: finalSoalPath, keterangan: 'Gambar Soal Utama', id_soal: questionId }
            });
        }
        
        // B. UPDATE DATA TEXT
        const { tipe_soal, text_soal, id_topik, level_kesulitan, pembahasan_umum, opsi_jawaban, action_type } = req.body;
        const statusSoal = action_type === 'Ajukan' ? StatusSoal.need_verification : StatusSoal.draft;
        
        let jenis = tipe_soal;
        if(tipe_soal === 'pilihan_ganda') jenis = 'multiple_choice';
        if(tipe_soal === 'multi_jawaban') jenis = 'multiple_answer';

        await prisma.soal.update({
            where: { id_soal: questionId },
            data: {
                text_soal, level_kesulitan, status: statusSoal, jenis_soal: jenis,
                id_topics: parseInt(id_topik),
            }
        });

        // C. UPDATE JAWABAN (DENGAN LOGIKA OLD_PATH)
        // Hapus data di DB (tapi file fisik jangan dihapus dulu)
        await prisma.jawabanSoal.deleteMany({ where: { soal_id_soal: questionId } });

        const parsedOpsi = JSON.parse(opsi_jawaban);
        let answerFileIndex = 0;

        const jawabanDataBaru = parsedOpsi.map((opsi) => {
            let finalPath = null;

            // KASUS 1: Ada upload file baru -> Pakai file baru
            if (opsi.has_image === true && newAnswerFilesList[answerFileIndex]) {
                 finalPath = `uploads/questions/${newAnswerFilesList[answerFileIndex].filename}`;
                 answerFileIndex++;
            } 
            // KASUS 2: Tidak ada upload baru -> Pakai path lama (JIKA ADA)
            else if (opsi.old_path && opsi.old_path !== "null" && opsi.old_path !== "") {
                 finalPath = opsi.old_path; // <--- INI KUNCI AGAR GAMBAR TIDAK HILANG
            }

            return {
                opsi_jawaban_text: opsi.text || "",
                status: opsi.is_correct,
                pembahasan: pembahasan_umum,
                soal_id_soal: questionId,
                path_gambar_jawaban: finalPath
            };
        });

        await prisma.jawabanSoal.createMany({ data: jawabanDataBaru });

        res.status(200).json({ message: 'Soal berhasil diperbarui.' });

    } catch (error) {
        if (newSoalFile) deleteFile(newSoalFile.path);
        if (newAnswerFilesList.length > 0) newAnswerFilesList.forEach(f => deleteFile(f.path));
        res.status(500).json({ message: error.message });
    }
};

// =================================================================
// 4. DELETE QUESTION
// =================================================================
const deleteQuestion = async (req, res) => {
    const questionId = parseInt(req.params.id);
    try {
        const existingSoal = await prisma.soal.findUnique({
            where: { id_soal: questionId }, include: { attachments: true, jawaban: true } 
        });
        if (!existingSoal) return res.status(404).json({ message: 'Soal tidak ditemukan.' });

        // Hapus File Fisik
        if (existingSoal.attachments.length > 0) deleteFile(existingSoal.attachments[0].path_attachment);
        existingSoal.jawaban.forEach(item => { if (item.path_gambar_jawaban) deleteFile(item.path_gambar_jawaban); });

        // Hapus DB
        await prisma.attachmentsSoal.deleteMany({ where: { id_soal: questionId } });
        await prisma.jawabanSoal.deleteMany({ where: { soal_id_soal: questionId } });
        await prisma.soal.delete({ where: { id_soal: questionId } });

        res.status(200).json({ message: `Soal ID ${questionId} berhasil dihapus.` });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menghapus soal.' });
    }
};

// 5. GET COMPETENT
const getCompetentSubjects = async (req, res) => {
    // ... (kode sama, tidak ada masalah di sini) ...
    // Biarkan saja atau copy dari yang sebelumnya jika butuh
    res.status(200).json({data: []}) 
};

module.exports = { addQuestion, getQuestionsByContributor, editQuestion, deleteQuestion, getCompetentSubjects };