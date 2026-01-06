const prisma = require(global.__basedir + '/config/prismaClient');
const { LevelKesulitan } = require('@prisma/client');

/**
 * 1. GET SUBJECTS LOOKUP (KHUSUS KONTRIBUTOR)
 * Mengambil hanya Mapel yang dikuasai kontributor berdasarkan tabel kompetensiUser
 */
exports.getSubjectsLookup = async (req, res) => {
    try {
        // Ambil ID dari token (UserID 12)
        const userId = req.user?.id || req.user?.id_user;

        if (!userId) {
            return res.status(401).json({ message: "Sesi tidak valid." });
        }

        // QUERY: Ambil data dari tabel relasi kompetensiUser
        const keahlian = await prisma.kompetensiUser.findMany({
            where: { 
                id_user: Number(userId) 
            },
            include: {
                subject: {
                    select: {
                        id_subject: true,
                        nama_subject: true,
                        keterangan: true
                    }
                }
            }
        });

        // Mapping hasil agar menjadi array of objects subject yang bersih
        const formattedData = keahlian.map(item => ({
            id_subject: item.subject.id_subject,
            nama_subject: item.subject.nama_subject,
            keterangan: item.subject.keterangan
        }));

        console.log(`[DEBUG] User ID ${userId} menarik ${formattedData.length} keahlian.`);

        return res.status(200).json({ 
            status: "success", 
            data: formattedData 
        });

    } catch (error) {
        console.error("ERROR getSubjectsLookup:", error);
        return res.status(500).json({ message: 'Gagal memfilter keahlian.' });
    }
};

/**
 * 2. GET TOPICS LOOKUP
 */
exports.getTopicsLookup = async (req, res) => {
    try {
        const { subjectId } = req.params;
        const topics = await prisma.topics.findMany({
            where: { id_subjects: parseInt(subjectId) },
            include: { jenjang: { select: { nama_jenjang: true } } },
            orderBy: { nama_topics: 'asc' }
        });

        const data = topics.map(t => ({
            id_topics: t.id_topics,
            nama_topics: t.nama_topics,
            jenjang_name: t.jenjang?.nama_jenjang || 'Umum'
        }));

        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ message: 'Error load topics' });
    }
};

/**
 * 3. GET LEVEL LOOKUP
 */
exports.getLevelKesulitanLookup = (req, res) => {
    const levels = Object.keys(LevelKesulitan).map(key => ({
        value: LevelKesulitan[key].toLowerCase(),
        label: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
    }));
    return res.status(200).json({ data: levels });
};