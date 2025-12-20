const prisma = require('../config/prismaClient'); 
const fs = require('fs');
const path = require('path');

// ==========================================
// 1. GET DASHBOARD BANK SOAL (UNIFIED)
// ==========================================
const getBankSoal = async (req, res) => {
    // Ambil parameter simulasi dari URL (default ke validator jika kosong)
    const roleSimulation = req.query.as_role || 'validator'; 

    try {
        let whereClause = {}; 
        let mockUser = null;
        if (roleSimulation.toLowerCase() === 'admin') {
            mockUser = await prisma.users.findFirst({ where: { role: 'Admin' } });
            whereClause.status = { not: 'draft' }; 
        } else {
            mockUser = await prisma.users.findFirst({ where: { role: 'Validator' } });

            if (!mockUser) {
                return res.status(200).json({ status: 'success', data: [], message: "Validator tidak ditemukan." });
            }

            const kompetensi = await prisma.kompetensiUser.findMany({
                where: { id_user: mockUser.id_user },
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
                    message: `Validator ${mockUser.nama_user} belum memiliki kompetensi.` 
                });
            }
        }

        const soalList = await prisma.soal.findMany({
            where: whereClause,
            orderBy: { id_soal: 'desc' },
            include: {
                contributor: { select: { nama_user: true } },
                topic: { include: { subject: { select: { nama_subject: true } } } },
                attachments: true 
            }
        });

        const formattedData = soalList.map((item) => ({
            id_soal: item.id_soal,
            text_soal: item.text_soal,
            mata_pelajaran: item.topic?.subject?.nama_subject || '-',
            topik: item.topic?.nama_topik || '-',
            tipe_soal: item.jenis_soal,
            level_kesulitan: item.level_kesulitan,
            status: item.status, 
            catatan_revisi: item.catatan_revisi, 
            contributor_name: item.contributor?.nama_user || 'Unknown',
            tanggal: item.tanggal_pembuatan
        }));

        res.status(200).json({ 
            status: 'success', 
            role_detected: roleSimulation,
            current_user_simulated: mockUser ? mockUser.nama_user : 'None',
            data: formattedData 
        });

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
                topic: { include: { subject: true } },
                jawaban: true,
                attachments: true
            }
        });
        
        if (!soal) return res.status(404).json({ message: 'Soal tidak ditemukan' });
        res.status(200).json({ status: 'success', data: soal });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ==========================================
// 3. UPDATE SOAL (VALIDASI, EDIT, & PAKET)
// ==========================================
const updateSoal = async (req, res) => {
    const { id } = req.params;
    
    // Ambil Data Body
    const { 
        id_paket_soal, 
        text_soal, level_kesulitan, jenis_soal, 
        status, catatan_revisi 
    } = req.body;

    try {
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

            // Logic Update Soal (Termasuk Validasi)
            const updateData = {};

            if (status) {
                if (status.toLowerCase() === 'disetujui') updateData.status = 'disetujui';
                else if (status.toLowerCase() === 'ditolak') updateData.status = 'ditolak';
                else if (status.toLowerCase() === 'need verification') updateData.status = 'need_verification';
                else updateData.status = status; 
            }

            if (catatan_revisi !== undefined) updateData.catatan_revisi = catatan_revisi;

            // Edit Konten
            if (text_soal) updateData.text_soal = text_soal;
            if (level_kesulitan) updateData.level_kesulitan = level_kesulitan;
            if (jenis_soal) updateData.jenis_soal = jenis_soal;
            
            // Eksekusi Update jika ada data
            if (Object.keys(updateData).length > 0) {
                await tx.soal.update({
                    where: { id_soal: parseInt(id) },
                    data: updateData
                });
            }
        });

        res.status(200).json({ status: 'success', message: 'Update/Validasi berhasil.' });
    } catch (error) {
        console.error("Error updateSoal:", error); 
        res.status(500).json({ message: "Gagal memproses update: " + error.message });
    }
};

// ==========================================
// 4. DELETE SOAL
// ==========================================
const deleteFile = (filePath) => {
    if (!filePath) return;
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '../../../../', filePath); 
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
};

const deleteSoal = async (req, res) => {
    const { id } = req.params;
    try {
        const soal = await prisma.soal.findUnique({
            where: { id_soal: parseInt(id) },
            include: { attachments: true, jawaban: true }
        });

        if (!soal) return res.status(404).json({ message: 'Soal tidak ditemukan.' });

        // Hapus File
        if (soal.attachments) soal.attachments.forEach(a => deleteFile(a.path_attachment));
        if (soal.jawaban) soal.jawaban.forEach(j => deleteFile(j.path_gambar_jawaban));

        // Hapus DB
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