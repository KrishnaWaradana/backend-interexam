const prisma = require('../config/prismaClient');

// =================================================================
// HELPER: AMBIL USER TERDEKAT (VALIDASI USER LOKAL)
// =================================================================
const getAdminOrUserIdFromDB = async () => {
    // 1. Cari Admin dulu (Prioritas)
    let user = await prisma.users.findFirst({
        where: { role: 'Admin' },
        select: { id_user: true, nama_user: true }
    });

    // 2. Jika Admin kosong, cari User siapa saja (User pendaftar pertama)
    if (!user) {
        user = await prisma.users.findFirst({
            select: { id_user: true, nama_user: true }
        });
    }

    // 3. Jika Database benar-benar kosong
    if (!user) throw new Error('DATABASE KOSONG: Belum ada user yang terdaftar di database lokal. Silakan register user dulu.');
    
    return user; 
};

// =================================================================
// 1. CREATE SUB-TOPIK
// =================================================================
const createSubTopic = async (req, res) => {
    const { nama_subtopics, keterangan, deskripsi, id_topics } = req.body;

    try {
        // Validasi: Pastikan ada User di Database Lokal
        const userPelaku = await getAdminOrUserIdFromDB(); 
        console.log(`[SubTopic] Create attempt by user: ${userPelaku.nama_user}`);

        if (!nama_subtopics || !id_topics) {
            return res.status(400).json({ message: "Nama Sub-Topik dan ID Topik wajib diisi." });
        }

        const parentTopic = await prisma.topics.findUnique({
            where: { id_topics: parseInt(id_topics) }
        });

        if (!parentTopic) {
            return res.status(404).json({ message: "Topik induk (Parent Topic) tidak ditemukan." });
        }

        const newSubTopic = await prisma.subTopics.create({
            data: {
                nama_subtopics,
                keterangan,
                deskripsi, 
                topic: {
                    connect: { id_topics: parseInt(id_topics) }
                }
            }
        });

        res.status(201).json({
            status: 'success',
            data: newSubTopic,
            message: `Sub-Topik berhasil dibuat. (Validated by User: ${userPelaku.nama_user})`
        });

    } catch (error) {
        console.error("Error createSubTopic:", error);
        res.status(500).json({ message: error.message });
    }
};

// =================================================================
// 2. GET ALL SUB-TOPICS
// =================================================================
const getSubTopics = async (req, res) => {
    const { id_topics } = req.query;

    try {
        let whereClause = {};
        if (id_topics) {
            whereClause = { id_topics: parseInt(id_topics) };
        }

        const subTopics = await prisma.subTopics.findMany({
            where: whereClause,
            include: {
                topic: { 
                    select: { 
                        nama_topics: true,
                        jenjang: { select: { nama_jenjang: true } } 
                    } 
                } 
            },
            orderBy: { id_subtopics: 'asc' }
        });

        res.status(200).json({ status: 'success', data: subTopics });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// =================================================================
// 3. GET DETAIL SUB-TOPIC
// =================================================================
const getSubTopicDetail = async (req, res) => {
    const { id } = req.params;
    try {
        const subTopic = await prisma.subTopics.findUnique({
            where: { id_subtopics: parseInt(id) },
            include: { topic: true }
        });

        if (!subTopic) return res.status(404).json({ message: "Sub-Topik tidak ditemukan." });

        res.status(200).json({ status: 'success', data: subTopic });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// =================================================================
// 4. UPDATE SUB-TOPIC
// =================================================================
const updateSubTopic = async (req, res) => {
    const { id } = req.params;
    const { nama_subtopics, keterangan, deskripsi, id_topics } = req.body;

    try {
        await getAdminOrUserIdFromDB(); // Validasi user ada

        const existing = await prisma.subTopics.findUnique({ where: { id_subtopics: parseInt(id) } });
        if (!existing) return res.status(404).json({ message: "Sub-Topik tidak ditemukan." });

        if (id_topics) {
            const checkTopic = await prisma.topics.findUnique({
                where: { id_topics: parseInt(id_topics) }
            });
            if (!checkTopic) return res.status(404).json({ message: "Topik tujuan tidak ditemukan." });
        }

        const updatedData = await prisma.subTopics.update({
            where: { id_subtopics: parseInt(id) },
            data: {
                nama_subtopics,
                keterangan,
                deskripsi,
                id_topics: id_topics ? parseInt(id_topics) : undefined
            }
        });

        res.status(200).json({ status: 'success', message: 'Sub-Topik berhasil diupdate.', data: updatedData });
    } catch (error) {
        res.status(500).json({ message: "Gagal update sub-topik." });
    }
};

// =================================================================
// 5. DELETE SUB-TOPIC
// =================================================================
const deleteSubTopic = async (req, res) => {
    const { id } = req.params;
    try {
        await getAdminOrUserIdFromDB(); // Validasi user ada

        await prisma.subTopics.delete({
            where: { id_subtopics: parseInt(id) }
        });

        res.status(200).json({ status: 'success', message: 'Sub-Topik berhasil dihapus.' });
    } catch (error) {
        if (error.code === 'P2003') {
             return res.status(400).json({ message: "Gagal hapus: Sub-Topik ini sedang digunakan oleh data lain." });
        }
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createSubTopic,
    getSubTopics,
    getSubTopicDetail,
    updateSubTopic,
    deleteSubTopic
};