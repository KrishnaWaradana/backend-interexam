const prisma = require(global.__basedir + '/config/prismaClient');
const { LevelKesulitan } = require('@prisma/client');

/**
 * 1. GET SUBJECTS LOOKUP
 * - ADMIN: Melihat SEMUA Mata Pelajaran (God Mode).
 * - CONTRIBUTOR & VALIDATOR: Hanya melihat mapel sesuai keahliannya.
 */
exports.getSubjectsLookup = async (req, res) => {
    try {
        // Akses aman ke properti user
        const userId = req.user?.id || req.user?.id_user;
        const userRole = req.user?.role; 

        if (!userId) {
            return res.status(401).json({ message: "Sesi tidak valid." });
        }

        let formattedData = [];

        // ==========================================================
        // A. JIKA ADMIN (GOD MODE)
        // ==========================================================
        if (userRole === 'Admin') {
            // Admin bisa melihat semua mata pelajaran tanpa batasan kompetensi
            const allSubjects = await prisma.subjects.findMany({
                orderBy: { nama_subject: 'asc' },
                select: {
                    id_subject: true,
                    nama_subject: true,
                    keterangan: true
                }
            });

            // Langsung pakai data subject
            formattedData = allSubjects;
            
            console.log(`[DEBUG] Admin ${userId} mengambil SEMUA (${formattedData.length}) subject.`);
        } 
        
        // ==========================================================
        // B. JIKA CONTRIBUTOR / VALIDATOR (SESUAI KEAHLIAN)
        // ==========================================================
        else {
            // Query ke tabel relasi kompetensiUser
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

            // Mapping hasil agar strukturnya sama (array of objects)
            formattedData = keahlian.map(item => ({
                id_subject: item.subject.id_subject,
                nama_subject: item.subject.nama_subject,
                keterangan: item.subject.keterangan
            }));
            
            console.log(`[DEBUG] ${userRole} ${userId} mengambil ${formattedData.length} mapel keahlian.`);
        }

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

        if (!subjectId) {
             return res.status(400).json({ message: 'Subject ID diperlukan.' });
        }

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
        console.error("ERROR getTopicsLookup:", error);
        return res.status(500).json({ message: 'Error load topics' });
    }
};

/**
 * 3. GET LEVEL LOOKUP
 */
exports.getLevelKesulitanLookup = (req, res) => {
    try {
        const levels = Object.keys(LevelKesulitan).map(key => ({
            value: LevelKesulitan[key].toLowerCase(),
            label: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
        }));
        return res.status(200).json({ data: levels });
    } catch (error) {
        return res.status(500).json({ message: 'Gagal load level kesulitan' });
    }
};