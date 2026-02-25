const prisma = require(global.__basedir + '/config/prismaClient');
const { StatusSoal } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// =================================================================
// HELPER BARU: PENYARING PATH & URL 
// =================================================================
const extractUploadPath = (urlOrPath) => {
    if (!urlOrPath) return null;
    let str = Array.isArray(urlOrPath) ? urlOrPath[0] : urlOrPath;
    if (typeof str !== 'string' || str === 'null' || str === '') return null;
    
    const normalized = str.replace(/\\/g, '/');
    const uploadIndex = normalized.indexOf('uploads/');
    
    if (uploadIndex !== -1) {
        return normalized.substring(uploadIndex); 
    }
    return normalized;
};

// =================================================================
// HELPER: HAPUS FILE
// =================================================================
const deleteFile = (filePath) => {
    const cleanPath = extractUploadPath(filePath);
    if (!cleanPath) return;

    const normalizedPath = cleanPath.replace(/\\/g, '/');
    const absolutePath = path.isAbsolute(normalizedPath) 
        ? normalizedPath 
        : path.join(global.__basedir, '../', normalizedPath); 

    if (fs.existsSync(absolutePath)) {
        try {
            fs.unlinkSync(absolutePath);
            console.log(`[FILE] Berhasil menghapus: ${absolutePath}`);
        } catch (err) {
            console.error(`[FILE] Gagal menghapus file: ${err.message}`);
        }
    }
};

// =================================================================
// HELPER: DUPLIKAT FILE FISIK 
// =================================================================
const copyExistingFile = (oldRelativePath, targetFolder) => {
    const cleanPath = extractUploadPath(oldRelativePath);
    if (!cleanPath) return null;
    
    const normalizedSource = cleanPath.replace(/\\/g, '/');
    const absoluteSourcePath = path.isAbsolute(normalizedSource)
        ? normalizedSource
        : path.join(global.__basedir, '../', normalizedSource);

    if (fs.existsSync(absoluteSourcePath)) {
        try {
            const ext = path.extname(absoluteSourcePath);
            const newFileName = `copy_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
            const uploadDir = path.join(global.__basedir, `../uploads/${targetFolder}`);
            
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const absoluteDestPath = path.join(uploadDir, newFileName);
            fs.copyFileSync(absoluteSourcePath, absoluteDestPath);
            console.log(`[FILE] Berhasil duplikat fisik: ${newFileName}`);

            return `uploads/${targetFolder}/${newFileName}`;
        } catch (err) {
            console.error(`[FILE] Gagal duplikat file: ${err.message}`);
            return null;
        }
    }
    return null;
};

// =================================================================
// HELPER: NOTIFIKASI PENGAJUAN SOAL
// =================================================================
const triggerSubmitNotification = async (soalId, id_topik, senderId) => {
    try {
        const topic = await prisma.topics.findUnique({
            where: { id_topics: parseInt(id_topik) },
            include: { subject: true }
        });
        if (!topic) return;

        const subjectId = topic.id_subjects;
        const subjectName = topic.subject.nama_subject;
        
        const senderData = await prisma.users.findUnique({ where: { id_user: parseInt(senderId) } });
        const senderName = senderData?.nama_user || "Contributor";

        const admins = await prisma.users.findMany({ where: { role: 'Admin' } });
        const validators = await prisma.kompetensiUser.findMany({
            where: { id_subject: subjectId },
            include: { user: true }
        });

        const recipientIds = new Set();
        admins.forEach(a => recipientIds.add(a.id_user));
        validators.forEach(v => { if (v.user.role === 'Validator') recipientIds.add(v.user.id_user); });

        const notifData = Array.from(recipientIds).map(rId => ({
            id_recipient: rId,
            id_sender: parseInt(senderId),
            id_soal: parseInt(soalId),
            title: "Pengajuan Soal Baru",
            message: `Contributor ${senderName} mengajukan soal mata pelajaran ${subjectName}. Menunggu validasi.`,
            is_read: false
        }));

        if (notifData.length > 0) await prisma.systemNotification.createMany({ data: notifData });
    } catch (err) {
        console.error("Gagal mengirim notif pengajuan:", err);
    }
};

// =================================================================
// 1. ADD QUESTION 
// =================================================================
const addQuestion = async (req, res) => {
    const files = req.files || {};
    const soalFile = files['image_soal'] ? files['image_soal'][0] : null;
    const answerFilesList = files['image_jawaban'] || [];
    const pembahasanFile = files['image_pembahasan'] ? files['image_pembahasan'][0] : null;

    let generatedFiles = [];
    let createdSoalId = null; 

    try { 
        const { 
            tipe_soal, text_soal, id_topik,id_subtopik, level_kesulitan, 
            pembahasan_umum, opsi_jawaban, action_type, 
            old_image_soal, old_image_pembahasan 
        } = req.body;
        
        if (!id_topik || id_topik === "undefined") throw new Error("Topik wajib dipilih!");
        
        const contributorId = req.user.id;
        const statusSoal = action_type === 'Ajukan' ? StatusSoal.need_verification : StatusSoal.draft;
        let jenis = tipe_soal === 'pilihan_ganda' ? 'multiple_choice' : 'multiple_answer';

        const newSoal = await prisma.soal.create({
            data: {
                tanggal_pembuatan: new Date().toISOString(),
                text_soal, jenis_soal: jenis, level_kesulitan, status: statusSoal,
                contributor: { connect: { id_user: contributorId } },
                topic: { connect: { id_topics: parseInt(id_topik) } }, 
            }
        });

        createdSoalId = newSoal.id_soal; 
        
        // 2. KUNCI PERBAIKAN: Proses Gambar Soal (SESUAIKAN DENGAN MULTER YAITU FOLDER 'paket')
        let finalSoalPath = null;
        if (soalFile) {
            finalSoalPath = `uploads/paket/${soalFile.filename}`; 
            generatedFiles.push(finalSoalPath);
        } else if (old_image_soal) {
            finalSoalPath = copyExistingFile(old_image_soal, 'paket');
            if(finalSoalPath) generatedFiles.push(finalSoalPath);
        }

        if (finalSoalPath) {
             await prisma.attachmentsSoal.create({ 
                 data: { path_attachment: finalSoalPath, keterangan: 'Gambar Soal', id_soal: createdSoalId } 
             });
        }

        // 3. Proses Gambar Pembahasan
        let finalPembahasanPath = null;
        if (pembahasanFile) {
            finalPembahasanPath = `uploads/photos/${pembahasanFile.filename}`;
            generatedFiles.push(finalPembahasanPath);
        } else if (old_image_pembahasan) {
            finalPembahasanPath = copyExistingFile(old_image_pembahasan, 'photos');
            if(finalPembahasanPath) generatedFiles.push(finalPembahasanPath);
        }

        if (finalPembahasanPath) {
             await prisma.attachmentsSoal.create({ 
                data: { path_attachment: finalPembahasanPath, keterangan: 'Gambar Pembahasan', id_soal: createdSoalId } 
            });
        }

        // 4. Proses Opsi Jawaban
        let parsedOpsi = JSON.parse(opsi_jawaban);
        let answerFileIndex = 0;
        
        const jawabanData = parsedOpsi.map((opsi) => {
            let imgPath = null;
            if (opsi.has_image === true && answerFilesList[answerFileIndex]) {
                imgPath = `uploads/photos/${answerFilesList[answerFileIndex].filename}`; 
                generatedFiles.push(imgPath);
                answerFileIndex++;
            } else if (opsi.old_path) {
                imgPath = copyExistingFile(opsi.old_path, 'photos');
                if(imgPath) generatedFiles.push(imgPath);
            }

            return {
                opsi_jawaban_text: opsi.text || "", 
                status: opsi.is_correct, 
                pembahasan: pembahasan_umum,
                soal_id_soal: createdSoalId,
                path_gambar_jawaban: imgPath 
            };
        });
        
        if (jawabanData.length > 0) {
            await prisma.jawabanSoal.createMany({ data: jawabanData });
        }

        if (statusSoal === StatusSoal.need_verification) {
            triggerSubmitNotification(createdSoalId, id_topik, contributorId).catch(console.error);
        }

        res.status(201).json({ message: 'Soal berhasil disimpan.', data: { soalId: createdSoalId } });

    } catch (error) {
        console.error(">>> ERROR ADD QUESTION:", error);
        
        // ROLLBACK JIKA GAGAL
        if (createdSoalId) {
            try {
                await prisma.jawabanSoal.deleteMany({ where: { soal_id_soal: createdSoalId } });
                await prisma.attachmentsSoal.deleteMany({ where: { id_soal: createdSoalId } });
                await prisma.soal.delete({ where: { id_soal: createdSoalId } });
                console.log(`[ROLLBACK] Soal ID ${createdSoalId} dihapus dari DB karena proses gagal.`);
            } catch (cleanupErr) {
                console.error("[ROLLBACK ERROR]:", cleanupErr);
            }
        }

        if (soalFile) deleteFile(soalFile.path);
        if (pembahasanFile) deleteFile(pembahasanFile.path);
        if (answerFilesList.length > 0) answerFilesList.forEach(f => deleteFile(f.path));
        if (generatedFiles.length > 0) generatedFiles.forEach(f => deleteFile(f));

        res.status(500).json({ message: error.message });
    }
};

// =================================================================
// 2. GET QUESTIONS
// =================================================================
const getQuestionsByContributor = async (req, res) => {
    try {
        const contributorId = req.user.id;
        
        const [totalSoal, totalVerified, totalDraft, totalRejected, totalNeed] = await Promise.all([
            prisma.soal.count({ where: { id_contributor: contributorId } }),
            prisma.soal.count({ where: { id_contributor: contributorId, status: StatusSoal.disetujui } }),
            prisma.soal.count({ where: { id_contributor: contributorId, status: StatusSoal.draft } }),
            prisma.soal.count({ where: { id_contributor: contributorId, status: StatusSoal.ditolak } }),
            prisma.soal.count({ where: { id_contributor: contributorId, status: StatusSoal.need_verification } })
        ]);

        const statistics = { 
            total_dibuat: totalSoal, total_tervalidasi: totalVerified, total_draft: totalDraft, 
            total_ditolak: totalRejected, total_need_verification: totalNeed 
        };

        const questions = await prisma.soal.findMany({
            where: { id_contributor: contributorId },
            include: { 
                topic: { include: { subject: true, jenjang: true } }, 
                attachments: true, 
                jawaban: true 
            },
            orderBy: { tanggal_pembuatan: 'desc' }
        });

        const formattedQuestions = questions.map(q => {
            const imgSoal = q.attachments.find(a => a.keterangan === 'Gambar Soal');
            const imgPembahasan = q.attachments.find(a => a.keterangan === 'Gambar Pembahasan');

            return {
                id: q.id_soal,
                nomor: q.id_soal, 
                mata_pelajaran: q.topic?.subject?.nama_subject || 'N/A', 
                jenjang: q.topic?.jenjang?.nama_jenjang || '-', 
                topik: q.topic?.nama_topics || '-',
                text_soal: q.text_soal,
                tipe_soal: q.jenis_soal,
                level_kesulitan: q.level_kesulitan,
                status: q.status,
                id_topik: q.id_topics,
                pembahasan_umum: q.jawaban.length > 0 ? q.jawaban[0].pembahasan : "",
                catatan_revisi: null, 
                gambar: imgSoal ? imgSoal.path_attachment : null, // Murni path asli untuk Frontend
                gambar_soal: imgSoal ? imgSoal.path_attachment : null, // Support kedua key agar aman
                gambar_pembahasan: imgPembahasan ? imgPembahasan.path_attachment : null,
                list_jawaban: q.jawaban 
            };
        });

        res.status(200).json({ message: 'Berhasil', data: formattedQuestions, statistics: statistics });
    } catch (error) {
        console.error("Error Get Questions:", error);
        res.status(500).json({ message: 'Gagal mengambil data.' });
    }
};

// =================================================================
// 3. EDIT QUESTION 
// =================================================================
const editQuestion = async (req, res) => {
    const questionId = parseInt(req.params.id);
    const files = req.files || {};
    
    const newSoalFile = files['image_soal'] ? files['image_soal'][0] : null;
    const newPembahasanFile = files['image_pembahasan'] ? files['image_pembahasan'][0] : null;
    const newAnswerFilesList = files['image_jawaban'] || [];

    try {
        const existingSoal = await prisma.soal.findUnique({
            where: { id_soal: questionId }, 
            include: { attachments: true, jawaban: true }
        });
        if (existingSoal.id_contributor !== req.user.id && req.user.role !== 'Admin') {
            return res.status(403).json({ message: "Anda tidak memiliki akses ke soal ini." });
        }
        if (!existingSoal) throw new Error('Soal tidak ditemukan.');

        // A. KUNCI PERBAIKAN: UPDATE GAMBAR SOAL SESUAI FOLDER 'paket'
        if (newSoalFile) {
            const finalSoalPath = `uploads/paket/${newSoalFile.filename}`;
            const oldSoalImg = existingSoal.attachments.find(a => a.keterangan === 'Gambar Soal');
            
            if (oldSoalImg) {
                deleteFile(oldSoalImg.path_attachment);
                await prisma.attachmentsSoal.delete({ where: { id_attachment: oldSoalImg.id_attachment } });
            }
            await prisma.attachmentsSoal.create({ 
                data: { path_attachment: finalSoalPath, keterangan: 'Gambar Soal', id_soal: questionId } 
            });
        }

        // B. UPDATE GAMBAR PEMBAHASAN
        if (newPembahasanFile) {
            const finalPembahasanPath = `uploads/photos/${newPembahasanFile.filename}`;
            const oldPembahasanImg = existingSoal.attachments.find(a => a.keterangan === 'Gambar Pembahasan');
            
            if (oldPembahasanImg) {
                deleteFile(oldPembahasanImg.path_attachment);
                await prisma.attachmentsSoal.delete({ where: { id_attachment: oldPembahasanImg.id_attachment } });
            }
            await prisma.attachmentsSoal.create({ 
                data: { path_attachment: finalPembahasanPath, keterangan: 'Gambar Pembahasan', id_soal: questionId } 
            });
        }
        
        // C. UPDATE TEXT DATA
        const { tipe_soal, text_soal, id_topik, level_kesulitan, pembahasan_umum, opsi_jawaban, action_type } = req.body;
        const statusSoal = action_type === 'Ajukan' ? StatusSoal.need_verification : StatusSoal.draft;
        
        let jenis = 'multiple_choice';
        if(tipe_soal) {
             jenis = (tipe_soal === 'pilihan_ganda' || tipe_soal === 'multiple_choice') ? 'multiple_choice' : 'multiple_answer';
        }

        await prisma.soal.update({
            where: { id_soal: questionId },
            data: { text_soal, level_kesulitan, status: statusSoal, jenis_soal: jenis, id_topics: parseInt(id_topik) }
        });

        // D. UPDATE JAWABAN
        await prisma.jawabanSoal.deleteMany({ where: { soal_id_soal: questionId } });

        const parsedOpsi = JSON.parse(opsi_jawaban);
        let answerFileIndex = 0;

        const jawabanDataBaru = parsedOpsi.map((opsi) => {
            let finalPath = null;
            if (opsi.has_image === true && newAnswerFilesList[answerFileIndex]) {
                 finalPath = `uploads/photos/${newAnswerFilesList[answerFileIndex].filename}`; 
                 answerFileIndex++;
            } 
            else if (opsi.old_path && opsi.old_path !== "null" && opsi.old_path !== "") {
                 finalPath = extractUploadPath(opsi.old_path); // Filter URL ke format lokal DB
            }

            return {
                opsi_jawaban_text: opsi.text || "",
                status: opsi.is_correct, 
                pembahasan: pembahasan_umum,
                soal_id_soal: questionId,
                path_gambar_jawaban: finalPath
            };
        });

        if(jawabanDataBaru.length > 0) {
            await prisma.jawabanSoal.createMany({ data: jawabanDataBaru });
        }
        
       if (statusSoal === StatusSoal.need_verification) {
            triggerSubmitNotification(questionId, id_topik, req.user.id).catch(console.error);
        }

        res.status(200).json({ message: 'Soal berhasil diperbarui.' });

    } catch (error) {
        console.error("Edit Error:", error);
        if (newSoalFile) deleteFile(newSoalFile.path);
        if (newPembahasanFile) deleteFile(newPembahasanFile.path);
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
        if (existingSoal.id_contributor !== req.user.id && req.user.role !== 'Admin') {
            return res.status(403).json({ message: "Anda tidak memiliki akses ke soal ini." });
        }
        if (!existingSoal) return res.status(404).json({ message: 'Soal tidak ditemukan.' });

        if (existingSoal.attachments && existingSoal.attachments.length > 0) {
            existingSoal.attachments.forEach(att => {
                deleteFile(att.path_attachment);
            });
        }
        
        existingSoal.jawaban.forEach(item => { 
            if (item.path_gambar_jawaban) deleteFile(item.path_gambar_jawaban); 
        });

        await prisma.attachmentsSoal.deleteMany({ where: { id_soal: questionId } });
        await prisma.jawabanSoal.deleteMany({ where: { soal_id_soal: questionId } });
        await prisma.soal.delete({ where: { id_soal: questionId } });

        res.status(200).json({ message: `Soal dihapus.` });
    } catch (e) { res.status(500).json({message: e.message}); }
};

// =================================================================
// 5. GET DETAIL QUESTION
// =================================================================
const getQuestionDetail = async (req, res) => {
    const { id } = req.params;
    try {
        const soal = await prisma.soal.findUnique({
            where: { id_soal: parseInt(id) },
            include: {
                attachments: true,
                jawaban: { orderBy: { id_jawaban: 'asc' } },
                topic: { include: { subject: true, jenjang: true } }
            }
        });

        if (!soal) return res.status(404).json({ message: 'Soal tidak ditemukan.' });

        const imgSoal = soal.attachments.find(a => a.keterangan === 'Gambar Soal');
        const imgPembahasan = soal.attachments.find(a => a.keterangan === 'Gambar Pembahasan');

        const formattedData = {
            id: soal.id_soal,
            text_soal: soal.text_soal,
            tipe_soal: soal.jenis_soal,
            level_kesulitan: soal.level_kesulitan,
            pembahasan_umum: soal.jawaban.length > 0 ? soal.jawaban[0].pembahasan : "",
            catatan_revisi: soal.catatan_revisi || null,
            status: soal.status,
            gambar: imgSoal ? imgSoal.path_attachment : null, // Murni path asli
            gambar_soal: imgSoal ? imgSoal.path_attachment : null, 
            gambar_pembahasan: imgPembahasan ? imgPembahasan.path_attachment : null,
            id_topik: soal.id_topics,
            id_subject: soal.topic ? soal.topic.id_subjects : null,
            nama_subject: soal.topic?.subject?.nama_subject, 
            list_jawaban: soal.jawaban.map(j => ({
                id: j.id_jawaban,
                opsi_jawaban_text: j.opsi_jawaban_text,
                status: j.status,
                path_gambar_jawaban: j.path_gambar_jawaban
            }))
        };

        res.status(200).json({ message: 'Berhasil', data: formattedData });
    } catch (error) {
        console.error("Error Detail:", error);
        res.status(500).json({ message: 'Gagal mengambil detail soal.' });
    }
};

const getCompetentSubjects = async (req, res) => { res.status(200).json({data: []}); };

module.exports = { addQuestion, getQuestionsByContributor, editQuestion, deleteQuestion, getCompetentSubjects, getQuestionDetail, };