const prisma = require('../config/prismaClient');

const topicController = {
  // 1. CREATE Topic (Beserta link ke Category/Jenjang)
  createTopic: async (req, res) => {
    try {
      // Ambil data dari body request (Sesuai form frontend)
      const { nama_topics, keterangan, id_subjects, id_category } = req.body;

      // Validasi input
      if (!nama_topics || !id_subjects || !id_category) {
        return res.status(400).json({ error: "Nama topik, Mata Pelajaran, dan Jenjang harus diisi" });
      }

      // Gunakan Transaction karena kita insert ke 2 tabel (topics & kategori_topics)
      const newTopic = await prisma.$transaction(async (tx) => {
        // A. Buat Topik baru
        const topic = await tx.topics.create({
          data: {
            nama_topics: nama_topics,
            keterangan: keterangan || "",
            id_subjects: parseInt(id_subjects), // Pastikan integer
          },
        });

        // B. Buat relasi ke Jenjang (Category) di tabel pivot
        await tx.categoryTopics.create({
          data: {
            id_topics: topic.id_topics,
            id_category: parseInt(id_category), // Pastikan integer
          },
        });

        return topic;
      });

      res.status(201).json({ 
        message: "Topik berhasil dibuat", 
        data: newTopic 
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Gagal membuat topik", details: error.message });
    }
  },

  // 2. READ ALL Topics (Beserta Subject dan Category-nya)
  getAllTopics: async (req, res) => {
    try {
      const topics = await prisma.topics.findMany({
        include: {
          subject: true, // Join ke tabel subjects
          categoryTopics: { // Join ke tabel pivot
            include: {
              category: true // Join lagi ke tabel categories untuk ambil nama jenjang
            }
          }
        },
        orderBy: {
            id_topics: 'desc'
        }
      });

      // Format data agar lebih rapi saat dikirim ke frontend
      const formattedTopics = topics.map(topic => ({
        id_topics: topic.id_topics,
        nama_topics: topic.nama_topics,
        keterangan: topic.keterangan,
        mata_pelajaran: topic.subject?.nama_subject,
        // Ambil kategori pertama (asumsi 1 topik 1 jenjang di form ini)
        jenjang: topic.categoryTopics[0]?.category?.nama_category || "-", 
      }));

      res.status(200).json({ data: formattedTopics });
    } catch (error) {
      res.status(500).json({ error: "Gagal mengambil data topik" });
    }
  },

  // 3. READ ONE Topic (Untuk Form Edit)
  getTopicById: async (req, res) => {
    try {
      const { id } = req.params;
      const topic = await prisma.topics.findUnique({
        where: { id_topics: parseInt(id) },
        include: {
            categoryTopics: true 
        }
      });

      if (!topic) return res.status(404).json({ error: "Topik tidak ditemukan" });

      // Siapkan data untuk pre-fill form
      const responseData = {
          ...topic,
          // Ambil id_category untuk default value dropdown jenjang
          id_category: topic.categoryTopics[0]?.id_category 
      };

      res.status(200).json({ data: responseData });
    } catch (error) {
      res.status(500).json({ error: "Gagal mengambil detail topik" });
    }
  },

  // 4. UPDATE Topic
  updateTopic: async (req, res) => {
    try {
      const { id } = req.params;
      const { nama_topics, keterangan, id_subjects, id_category } = req.body;

      // Transaction update
      const updatedTopic = await prisma.$transaction(async (tx) => {
        // A. Update data tabel Topics utama
        const topic = await tx.topics.update({
          where: { id_topics: parseInt(id) },
          data: {
            nama_topics,
            keterangan,
            id_subjects: parseInt(id_subjects),
          },
        });

        // B. Update Jenjang (Category)
        // Karena ini tabel pivot, cara termudah adalah hapus lama -> buat baru
        if (id_category) {
            // 1. Hapus relasi lama
            await tx.categoryTopics.deleteMany({
                where: { id_topics: parseInt(id) }
            });

            // 2. Buat relasi baru
            await tx.categoryTopics.create({
                data: {
                    id_topics: parseInt(id),
                    id_category: parseInt(id_category)
                }
            });
        }

        return topic;
      });

      res.status(200).json({ message: "Topik berhasil diupdate", data: updatedTopic });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Gagal mengupdate topik" });
    }
  },

  // 5. DELETE Topic
  deleteTopic: async (req, res) => {
    try {
      const { id } = req.params;

      // Transaction delete (Hapus anak dulu baru induk karena RESTRICT)
      await prisma.$transaction(async (tx) => {
        // 1. Hapus dulu relasi di tabel pivot kategori_topics
        await tx.categoryTopics.deleteMany({
            where: { id_topics: parseInt(id) }
        });
        
        // Catatan: Jika ada Soal yang menggunakan topik ini, 
        // Anda juga harus menghapus/mengubah soal tersebut atau validasi akan error (RESTRICT).

        // 2. Hapus topik
        await tx.topics.delete({
          where: { id_topics: parseInt(id) },
        });
      });

      res.status(200).json({ message: "Topik berhasil dihapus" });
    } catch (error) {
      console.error(error);
      // Cek error prisma code untuk foreign key constraint
      if (error.code === 'P2003') {
          return res.status(400).json({ error: "Tidak bisa menghapus topik ini karena sedang digunakan oleh Soal." });
      }
      res.status(500).json({ error: "Gagal menghapus topik" });
    }
  }
};

module.exports = topicController;