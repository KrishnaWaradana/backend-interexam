const prisma = require('../config/prismaClient');

const topicController = {
  
  // --- 1. CREATE TOPIC (Dengan Cek Duplikat) ---
  createTopic: async (req, res) => {
    try {
      const { nama_topics, keterangan, id_subjects, id_jenjang } = req.body;

      // A. Validasi Input Kosong
      if (!nama_topics || !id_subjects || !id_jenjang) {
        return res.status(400).json({ error: "Nama topik, Mata Pelajaran, dan Jenjang wajib diisi" });
      }

      // B. CEK DUPLIKAT DATA
      // Kita cari di database: Apakah ada topik dengan Nama, Subject, DAN Jenjang yang sama?
      const existingTopic = await prisma.topics.findFirst({
        where: {
          nama_topics: {
            equals: nama_topics,
            mode: 'insensitive' // Agar 'Aljabar' dan 'aljabar' dianggap sama
          },
          id_subjects: parseInt(id_subjects),
          id_jenjang: parseInt(id_jenjang)
        }
      });

      // Jika data ditemukan, berarti duplikat -> Kirim Error 409
      if (existingTopic) {
        return res.status(409).json({ error: "Topik ini sudah ada di Mata Pelajaran dan Jenjang tersebut." });
      }

      // C. Simpan ke Database (Jika aman)
      const newTopic = await prisma.topics.create({
        data: {
          nama_topics: nama_topics,
          keterangan: keterangan || "", 
          id_subjects: parseInt(id_subjects),
          id_jenjang: parseInt(id_jenjang)
        },
      });

      res.status(201).json({ 
        message: "Topik berhasil dibuat", 
        data: newTopic 
      });

    } catch (error) {
      console.error("Error Create Topic:", error);
      res.status(500).json({ error: "Gagal membuat topik", details: error.message });
    }
  },

  // --- 2. READ ALL TOPICS ---
  getAllTopics: async (req, res) => {
    try {
      const topics = await prisma.topics.findMany({
        include: {
          subject: true, // Relasi ke tabel subjects
          jenjang: true  // Relasi ke tabel jenjang
        },
        orderBy: { id_topics: 'desc' }
      });

      const formattedTopics = topics.map(topic => ({
        id_topics: topic.id_topics,
        nama_topics: topic.nama_topics,
        mata_pelajaran: topic.subject?.nama_subject || "-",
        jenjang: topic.jenjang?.nama_jenjang || "-",
        keterangan: topic.keterangan
      }));

      res.status(200).json({ data: formattedTopics });
    } catch (error) {
      console.error("Error Get Topics:", error);
      res.status(500).json({ error: "Gagal mengambil data topik" });
    }
  },

  // --- 3. READ ONE TOPIC (Untuk Edit) ---
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
      const updatedTopic = await prisma.topics.update({
        where: { id_topics: parseInt(id) },
        data: {
          nama_topics,
          keterangan,
          id_subjects: parseInt(id_subjects),
          id_jenjang: parseInt(id_jenjang)
        },
      });

      res.status(200).json({ message: "Topik berhasil diupdate", data: updatedTopic });

    } catch (error) {
      res.status(500).json({ error: "Gagal mengupdate topik" });
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
  }
};

module.exports = topicController;