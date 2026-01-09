const prisma = require(global.__basedir + '/config/prismaClient');
const { LevelKesulitan } = require('@prisma/client');

/**
 * 1. GET SUBJECTS LOOKUP (KHUSUS KONTRIBUTOR)
 * Mengambil hanya Mapel yang dikuasai kontributor berdasarkan tabel kompetensiUser
 */
exports.getSubjectsLookup = async (req, res) => {
    try {
        // req.user.id_user didapat dari middleware authenticateToken
        const userId = req.user.id_user; 

        const kompetensi = await prisma.kompetensiUser.findMany({
            where: { id_user: userId },
            include: {
                subject: {
                    select: { id_subject: true, nama_subject: true }
                }
            }
        });

        const mappedData = kompetensi.map(k => ({
            id_subject: k.subject.id_subject,
            nama_subject: k.subject.nama_subject
        }));

        res.status(200).json({ data: mappedData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal mengambil data Mata Pelajaran sesuai kompetensi.' });
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