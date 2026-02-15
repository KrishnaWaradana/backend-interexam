const prisma = require('../config/prismaClient'); 
const fs = require('fs');
const path = require('path');

// ==========================================
// 1. GET DASHBOARD BANK SOAL (UNIFIED)
// ==========================================
const getBankSoal = async (req, res) => {
    const userId = req.user?.id || req.user?.id_user;
    const userRole = req.user?.role; 

    try {
        let whereClause = {}; 
        
        // --- LOGIKA 1: ADMIN (Melihat Semua) ---
        if (userRole === 'Admin') {
            whereClause.status = { not: 'draft' }; 
        } 
        // --- LOGIKA 2: VALIDATOR (Filter Kompetensi) ---
        else if (userRole === 'Validator') {
            const kompetensi = await prisma.kompetensiUser.findMany({
                where: { id_user: parseInt(userId) },
                select: { id_subject: true }
            });
        
            const subjectIds = kompetensi.map(k => k.id_subject);
        
            if (subjectIds.length > 0) {
                whereClause = {
                    topic: { id_subjects: { in: subjectIds } },
                    status: { not: 'draft' } 
                };
            } else {
                return res.status(200).json({ 
                    status: 'success', 
                    data: [], 
                    message: "Anda belum memiliki akses ke bidang studi manapun. Hubungi Admin." 
                });
            }
        } 
        // --- LOGIKA 3: SAFETY (Cegah Role Lain) ---
        else {
             return res.status(403).json({ message: "Akses Ditolak." });
        }

        const soalList = await prisma.soal.findMany({
            where: whereClause,
            orderBy: { id_soal: 'desc' },
            include: {
                contributor: { select: { nama_user: true } },
                topic: { 
                    include: { 
                        subject: { select: { nama_subject: true } },
                        jenjang: { select: { nama_jenjang: true } }
                    } 
                },
                attachments: true 
            }
        });

        const formattedData = soalList.map((item) => ({
            id_soal: item.id_soal,
            text_soal: item.text_soal,
            mata_pelajaran: item.topic?.subject?.nama_subject || '-',
            jenjang: item.topic?.jenjang?.nama_jenjang || '-',
            topik: item.topic?.nama_topics || '-', 
            tipe_soal: item.jenis_soal,
            level_kesulitan: item.level_kesulitan,
            status: item.status, 
            catatan_revisi: item.catatan_revisi, 
            contributor_name: item.contributor?.nama_user || 'Unknown',
            tanggal: item.tanggal_pembuatan
        }));

        res.status(200).json({ status: 'success', role_detected: userRole, data: formattedData });
    } catch (error) {
        console.error("Error getBankSoal:", error);
        res.status(500).json({ message: error.message });
    }
};

// ==========================================
// 2. GET DETAIL SOAL
// ==========================================
const getSoalDetail = async (req, res) => {
    const { id } = req.params;
    try {
        const soal = await prisma.soal.findUnique({
            where: { id_soal: parseInt(id) },
            include: {
                contributor: { select: { nama_user: true } },
                topic: { include: { subject: true, jenjang: true } },
                jawaban: true,
                attachments: true,
                soalPaket: {
                    include: {
                        paketSoal: { select: { nama_paket: true } }
                    }
                },
                validasi: {
                    orderBy: { id_validasi: 'desc' }, 
                    take: 1,
                    include: { validator: { select: { nama_user: true } } }
                }
            }
        });
        
        if (!soal) return res.status(404).json({ message: 'Soal tidak ditemukan' });

        let namaValidator = '-';
        if (soal.validasi && soal.validasi.length > 0) {
            namaValidator = soal.validasi[0].validator?.nama_user || '-';
        }

        const responseData = {
            ...soal,
            list_paket: soal.soalPaket?.map(item => item.paketSoal?.nama_paket).filter(Boolean) || [],
            nama_validator: namaValidator,
            mata_pelajaran: soal.topic?.subject?.nama_subject,
            nama_topik: soal.topic?.nama_topics
        };

        res.status(200).json({ status: 'success', data: responseData });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ==========================================
// 3. UPDATE SOAL (VALIDASI)
// ==========================================
const updateSoal = async (req, res) => {
    const { id } = req.params;
    const validatorId = req.user?.id || req.user?.id_user;
    
    const { 
        id_paket_soal, text_soal, level_kesulitan, jenis_soal, 
        status, catatan_revisi, id_subtopik 
    } = req.body;

    try {
        // [1] DEKLARASIKAN VARIABEL DI SINI AGAR BISA DIBACA OLEH NOTIFIKASI
        let finalStatusEnum = null;

        await prisma.$transaction(async (tx) => {
            // Logic Masukkan ke Paket
            if (id_paket_soal) {
                const existing = await tx.soalPaketSoal.findFirst({
                    where: { id_soal: parseInt(id), id_paket_soal: parseInt(id_paket_soal) }
                });
                if (!existing) {
                    await tx.soalPaketSoal.create({
                        data: { id_soal: parseInt(id), id_paket_soal: parseInt(id_paket_soal), point: 1, durasi: 60 }
                    });
                }
            }

            // Logic Update Status & Konten
            const updateData = {};

            if (status) {
                if (status.toLowerCase() === 'disetujui') {
                    updateData.status = 'disetujui';
                    finalStatusEnum = 'disetujui';
                }
                else if (status.toLowerCase() === 'ditolak') {
                    updateData.status = 'ditolak';
                    finalStatusEnum = 'ditolak';
                }
                else if (status.toLowerCase() === 'need verification') {
                    updateData.status = 'need_verification';
                }
                else {
                    updateData.status = status; 
                }
            }

            if (catatan_revisi !== undefined) updateData.catatan_revisi = catatan_revisi;
            if (text_soal) updateData.text_soal = text_soal;
            if (level_kesulitan) updateData.level_kesulitan = level_kesulitan;
            if (jenis_soal) updateData.jenis_soal = jenis_soal;

            if (Object.keys(updateData).length > 0) {
                await tx.soal.update({
                    where: { id_soal: parseInt(id) },
                    data: updateData
                });
            }
            
            // Simpan Validator ke History
            if (finalStatusEnum && validatorId) {
                await tx.validasiSoal.create({
                    data: {
                        id_soal: parseInt(id),
                        id_validator: parseInt(validatorId),
                        status: finalStatusEnum, 
                        tanggal_validasi: new Date(),
                        keterangan: catatan_revisi || (finalStatusEnum === 'disetujui' ? 'Soal disetujui' : 'Soal ditolak')
                    }
                });
            }
        });

       // [2] --- TRIGGER NOTIFIKASI APPROVE/REJECT ---
        if (finalStatusEnum && validatorId) {
            try {
                // Cari data soal untuk mengetahui siapa contributornya
                const updatedSoal = await prisma.soal.findUnique({
                    where: { id_soal: parseInt(id) },
                    include: { topic: { include: { subject: true } }, contributor: true }
                });

                // ====================================================================
                // BERSIHKAN SEMUA NOTIFIKASI LAMA UNTUK ADMIN/VALIDATOR
                // ====================================================================
                await prisma.systemNotification.updateMany({
                    where: {
                        id_soal: parseInt(id),
                        id_recipient: { not: updatedSoal.contributor.id_user },
                        is_read: false
                    },
                    data: {
                        is_read: true
                    }
                });

                // 2. KIRIM NOTIFIKASI HASIL KE CONTRIBUTOR
                const senderData = await prisma.users.findUnique({ where: { id_user: parseInt(validatorId) } });

                const title = finalStatusEnum === 'disetujui' ? "Soal Disetujui" : "Pengajuan Soal Ditolak";
                const msg = finalStatusEnum === 'disetujui'
                    ? `Selamat! Soal ${updatedSoal.topic.subject.nama_subject} Anda telah disetujui oleh ${senderData.nama_user}.`
                    : `Maaf, soal ${updatedSoal.topic.subject.nama_subject} Anda ditolak oleh ${senderData.nama_user}. Catatan: ${catatan_revisi || '-'}`;

                await prisma.systemNotification.create({
                    data: {
                        id_recipient: updatedSoal.contributor.id_user,
                        id_sender: parseInt(validatorId),
                        id_soal: parseInt(id),
                        title: title,
                        message: msg,
                        is_read: false
                    }
                });

            } catch (notifErr) {
                console.error("Gagal memproses update notifikasi:", notifErr);
            }
        }

        res.status(200).json({ status: 'success', message: 'Update/Validasi berhasil.' });
    } catch (error) {
        console.error("Error updateSoal:", error); 
        res.status(500).json({ message: "Gagal memproses update: " + error.message });
    }
};

// ==========================================
// 4. DELETE SOAL
// ==========================================
const deleteFileHelper = (filePath) => {
    if (!filePath) return;
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(global.__basedir, '../', filePath); 
    if (fs.existsSync(absolutePath)) {
        try { fs.unlinkSync(absolutePath); } catch(e) {}
    }
};

const deleteSoal = async (req, res) => {
    const { id } = req.params;
    try {
        const soal = await prisma.soal.findUnique({
            where: { id_soal: parseInt(id) },
            include: { attachments: true, jawaban: true }
        });

        if (!soal) return res.status(404).json({ message: 'Soal tidak ditemukan.' });

        if (soal.attachments) soal.attachments.forEach(a => deleteFileHelper(a.path_attachment));
        if (soal.jawaban) soal.jawaban.forEach(j => deleteFileHelper(j.path_gambar_jawaban));

        await prisma.$transaction(async (tx) => {
            await tx.attachmentsSoal.deleteMany({ where: { id_soal: parseInt(id) } });
            await tx.jawabanSoal.deleteMany({ where: { soal_id_soal: parseInt(id) } });
            await tx.validasiSoal.deleteMany({ where: { id_soal: parseInt(id) } });
            await tx.soalPaketSoal.deleteMany({ where: { id_soal: parseInt(id) } });
            await tx.soal.delete({ where: { id_soal: parseInt(id) } });
        });

        res.status(200).json({ status: 'success', message: 'Soal dihapus permanen.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ==========================================
// 5. LOOKUP DROPDOWN PAKET
// ==========================================
const getLookupPackets = async (req, res) => {
    try {
        const packets = await prisma.paketSoal.findMany({
            select: { id_paket_soal: true, nama_paket: true },
            orderBy: { id_paket_soal: 'desc' }
        });
        res.status(200).json({ status: 'success', data: packets });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { 
    getBankSoal, 
    getSoalDetail, 
    updateSoal, 
    deleteSoal,
    getLookupPackets
};