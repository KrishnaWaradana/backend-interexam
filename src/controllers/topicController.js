const prisma = require('../config/prismaClient');

const topicController = {
  
  // --- 1. CREATE TOPIC ---
  createTopic: async (req, res) => {
    try {
      const { nama_topics, keterangan, id_subjects, id_jenjang } = req.body;
      const userId = req.user.id;

      // Validasi Input
      if (!nama_topics || !id_subjects || !id_jenjang) {
        return res.status(400).json({ error: "Nama topik, Mata Pelajaran, dan Jenjang wajib diisi" });
      }

      // Cek Duplikat
      const existingTopic = await prisma.topics.findFirst({
        where: {
          nama_topics: { equals: nama_topics, mode: 'insensitive' },
          id_subjects: parseInt(id_subjects),
          id_jenjang: parseInt(id_jenjang)
        }
      });

      if (existingTopic) {
        return res.status(409).json({ error: "Topik ini sudah ada di Mata Pelajaran dan Jenjang tersebut." });
      }

      // Simpan ke Database
      const newTopic = await prisma.topics.create({
        data: {
          nama_topics: nama_topics,
          keterangan: keterangan || "", 
          id_subjects: parseInt(id_subjects),
          id_jenjang: parseInt(id_jenjang),
          id_user: userId
        },
      });

      res.status(201).json({ message: "Topik berhasil dibuat", data: newTopic });

    } catch (error) {
      console.error("Error Create Topic:", error);
      res.status(500).json({ error: "Gagal membuat topik", details: error.message });
    }
  },

  // ============================================================
  // --- 2. READ ALL TOPICS (LOGIKA FILTER DIPERBARUI) ---
  // ============================================================
  getAllTopics: async (req, res) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role; 

      let whereClause = {};

      // A. Jika ADMIN: Tampilkan SEMUA topik
      if (userRole === 'Admin') {
        whereClause = {};
      } 
      // B. Jika Contributor / Validator
      else {
        // 1. Cek User ini ahli di mapel apa saja?
        const kompetensi = await prisma.kompetensiUser.findMany({
            where: { id_user: parseInt(userId) },
            select: { id_subject: true }
        });

        const subjectIds = kompetensi.map(k => k.id_subject);

        if (subjectIds.length > 0) {
            // 2. Tampilkan Topik yang Subject-nya sesuai keahlian dia
            // ATAU topik yang dia buat sendiri.
            whereClause = {
                OR: [
                    { id_subjects: { in: subjectIds } }, // Topik sesuai keahlian (buatan siapapun/admin)
                    { id_user: parseInt(userId) }        // Topik buatan sendiri
                ]
            };
        } else {
            // 3. Jika belum disetting kompetensinya, hanya tampilkan buatan sendiri
            whereClause = { id_user: parseInt(userId) };
        }
      }

      const topics = await prisma.topics.findMany({
        where: whereClause,
        include: {
          subject: true, 
          jenjang: true 
        },
        orderBy: { id_topics: 'desc' }
      });

      const formattedTopics = topics.map(topic => ({
        id_topics: topic.id_topics,
        nama_topics: topic.nama_topics,
        mata_pelajaran: topic.subject?.nama_subject || "-",
        jenjang: topic.jenjang?.nama_jenjang || "-",
        keterangan: topic.keterangan,
        is_owner: topic.id_user === userId // Flag untuk frontend jika butuh (opsional)
      }));

      res.status(200).json({ data: formattedTopics });
    } catch (error) {
      console.error("Error Get Topics:", error);
      res.status(500).json({ error: "Gagal mengambil data topik" });
    }
  },

  // --- 3. READ ONE TOPIC ---
  getTopicById: async (req, res) => {
    try {
      const { id } = req.params;
      const topic = await prisma.topics.findUnique({
        where: { id_topics: parseInt(id) },
        include: { subject: true, jenjang: true }
      });

      if (!topic) return res.status(404).json({ error: "Topik tidak ditemukan" });

      res.status(200).json({ data: topic });
    } catch (error) {
      res.status(500).json({ error: "Gagal mengambil detail topik" });
    }
  },

  // --- 4. UPDATE TOPIC ---
  updateTopic: async (req, res) => {
    try {
      const { id } = req.params;
      const { nama_topics, keterangan, id_subjects, id_jenjang } = req.body;
      const idToUpdate = parseInt(id); 

      // Validasi Input Dasar
      if (!nama_topics || !id_subjects || !id_jenjang) {
          return res.status(400).json({ error: "Nama topik, Mata Pelajaran, dan Jenjang wajib diisi" });
      }

      // Cek Duplikat (Kecuali diri sendiri)
      const duplicateCheck = await prisma.topics.findFirst({
        where: {
          nama_topics: { equals: nama_topics, mode: 'insensitive' },
          id_subjects: parseInt(id_subjects),
          id_jenjang: parseInt(id_jenjang),
          NOT: { id_topics: idToUpdate }
        }
      });

      if (duplicateCheck) {
        return res.status(409).json({ error: "Gagal Update: Nama Topik ini sudah digunakan pada data lain." });
      }

      // Lakukan Update
      const updatedTopic = await prisma.topics.update({
        where: { id_topics: idToUpdate },
        data: {
          nama_topics: nama_topics,
          keterangan: keterangan || "", 
          id_subjects: parseInt(id_subjects),
          id_jenjang: parseInt(id_jenjang)
        },
      });

      res.status(200).json({ message: "Topik berhasil diupdate", data: updatedTopic });

    } catch (error) {
      console.error("Error Update Topic:", error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: "Topik tidak ditemukan atau sudah dihapus." });
      }
      res.status(500).json({ error: "Gagal mengupdate topik", details: error.message });
    }
  },

  // --- 5. DELETE TOPIC ---
  deleteTopic: async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.topics.delete({
        where: { id_topics: parseInt(id) },
      });
      res.status(200).json({ message: "Topik berhasil dihapus" });
    } catch (error) {
      if (error.code === 'P2003') {
          return res.status(400).json({ error: "Topik ini sedang digunakan di Soal, tidak bisa dihapus." });
      }
      res.status(500).json({ error: "Gagal menghapus topik" });
    }
  }, 
  
  // --- 6. GET TOPICS BY SUBJECT (Dropdown Helper) ---
  getTopicsBySubjectId: async (req, res) => {
      try {
        const { subjectId } = req.params;
        
        if (!subjectId || isNaN(parseInt(subjectId))) {
          return res.status(400).json({ error: "ID Subject tidak valid" });
        }
  
        const topics = await prisma.topics.findMany({
          where: { id_subjects: parseInt(subjectId) },
          include: { jenjang: true },
          orderBy: { nama_topics: 'asc' }
        });
        
        res.status(200).json({ message: "Data topik berhasil diambil", data: topics });
  
      } catch (error) {
        console.error("Error Get Topics By Subject:", error);
        res.status(500).json({ error: "Gagal mengambil data topik untuk dropdown" });
      }
    }
};

module.exports = topicController;