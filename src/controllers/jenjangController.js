const prisma = require('../config/prismaClient');

const jenjangController = {
  // --- 1. CREATE JENJANG ---
  createJenjang: async (req, res) => {
    const { nama_jenjang, keterangan } = req.body;

    try {
      // 1. Validasi Input Wajib
      if (!nama_jenjang) {
        return res.status(400).json({ error: "Nama jenjang wajib diisi" });
      }

      // 2. Cek Duplikasi (CREATE) - Case Insensitive
      const existing = await prisma.jenjang.findFirst({
        where: { 
            nama_jenjang: { equals: nama_jenjang, mode: 'insensitive' } 
        }
      });

      if (existing) {
        return res.status(409).json({ error: `Jenjang dengan nama '${nama_jenjang}' sudah ada.` });
      }

      // 3. Simpan ke DB
      const newJenjang = await prisma.jenjang.create({
        data: {
          nama_jenjang,
          keterangan: keterangan || ""
        }
      });

      res.status(201).json({ 
        message: "Jenjang berhasil dibuat", 
        data: newJenjang 
      });

    } catch (error) {
      console.error("Error Create Jenjang:", error);
      res.status(500).json({ error: "Gagal membuat jenjang" });
    }
  },

  // --- 2. READ ALL JENJANG ---
  getAllJenjang: async (req, res) => {
    try {
      const jenjangList = await prisma.jenjang.findMany({
        orderBy: { id_jenjang: 'asc' }
      });
      
      res.status(200).json({ 
        message: "Data jenjang berhasil diambil",
        data: jenjangList 
      });
    } catch (error) {
      console.error("Error Get Jenjang:", error);
      res.status(500).json({ error: "Gagal mengambil data jenjang" });
    }
  },

  // --- 3. UPDATE JENJANG ---
  updateJenjang: async (req, res) => {
    const { id } = req.params;
    const { nama_jenjang, keterangan } = req.body;
    const jenjangId = parseInt(id);

    try {
      // 1. Cek apakah Jenjang ada
      const currentJenjang = await prisma.jenjang.findUnique({
        where: { id_jenjang: jenjangId }
      });

      if (!currentJenjang) {
        return res.status(404).json({ error: "Jenjang tidak ditemukan" });
      }

      // 2. Cek Duplikasi (UPDATE) - Case Insensitive
      if (nama_jenjang && nama_jenjang !== currentJenjang.nama_jenjang) {
          const checkDuplicate = await prisma.jenjang.findFirst({
            where: {
                nama_jenjang: { equals: nama_jenjang, mode: 'insensitive' },
                // Pastikan yang dicek BUKAN diri sendiri (exclude current ID)
                NOT: { id_jenjang: jenjangId }
            }
          });

          if (checkDuplicate) {
            return res.status(409).json({ error: `Jenjang '${nama_jenjang}' sudah digunakan.` });
          }
      }

      // 3. Update Data
      const updatedJenjang = await prisma.jenjang.update({
        where: { id_jenjang: jenjangId },
        data: { 
            nama_jenjang: nama_jenjang || currentJenjang.nama_jenjang, 
            keterangan: keterangan 
        }
      });

      res.status(200).json({ 
        message: "Jenjang berhasil diupdate", 
        data: updatedJenjang 
      });

    } catch (error) {
      console.error("Error Update Jenjang:", error);
      res.status(500).json({ error: "Gagal update jenjang" });
    }
  },

  // --- 4. DELETE JENJANG ---
  deleteJenjang: async (req, res) => {
    const { id } = req.params;
    try {
      await prisma.jenjang.delete({
        where: { id_jenjang: parseInt(id) }
      });
      
      res.status(200).json({ message: "Jenjang berhasil dihapus" });

    } catch (error) {
      if (error.code === 'P2003') {
          return res.status(409).json({ 
            error: "Gagal hapus: Jenjang ini sedang digunakan oleh Topik. Hapus Topik terkait terlebih dahulu." 
          });
      }
      if (error.code === 'P2025') {
          return res.status(404).json({ error: "Jenjang tidak ditemukan." });
      }
      res.status(500).json({ error: "Gagal hapus jenjang" });
    }
  }
};

module.exports = jenjangController;