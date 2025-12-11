// apps/backend/src/controllers/contributor/questionLookupController.js

const prisma = require(global.__basedir + '/config/prismaClient'); 
const { LevelKesulitan } = require('@prisma/client'); // Mengambil ENUM Level Kesulitan

// 1. MATA PELAJARAN (Dari Subjects)
exports.getSubjectsLookup = async (req, res) => {
    try {
        const subjects = await prisma.subjects.findMany({
            select: { id_subject: true, nama_subject: true },
            orderBy: { nama_subject: 'asc' }
        });
        res.status(200).json({ data: subjects.map(s => ({ id: s.id_subject, name: s.nama_subject })) });
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil data Mata Pelajaran.' });
    }
};

// 2. TOPIK (Dari Topics, difilter berdasarkan Subject ID)
exports.getTopicsLookup = async (req, res) => {
    const { subjectId } = req.params; 
    
    try {
        const topics = await prisma.topics.findMany({
            where: { id_subjects: parseInt(subjectId) }, 
            select: { id_topics: true, nama_topics: true },
            orderBy: { nama_topics: 'asc' }
        });
        res.status(200).json({ data: topics.map(t => ({ id: t.id_topics, name: t.nama_topics })) });
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil data Topik.' });
    }
};

// 3. LEVEL KESULITAN (Dari ENUM)
exports.getLevelKesulitanLookup = (req, res) => {
    const levels = Object.keys(LevelKesulitan).map(key => ({
        value: LevelKesulitan[key],
        label: key.charAt(0).toUpperCase() + key.slice(1) 
    }));
    res.status(200).json({ data: levels });
};