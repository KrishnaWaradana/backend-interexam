const prisma = require('../config/prismaClient');

const jenjangController = {
  // --- 1. CREATE JENJANG ---
  createJenjang: async (req, res) => {
    const { nama_jenjang, keterangan } = req.body;

    try {
      // Validasi Input
      if (!nama_jenjang) {
        return res.status(400).json({ error: "Nama jenjang wajib diisi" });
      }

      // Cek Duplikasi (Optional - agar tidak ada 2 SD)
      const existing = await prisma.jenjang.findFirst({
        where: { nama_jenjang: nama_jenjang }
      });
      if (existing) {
        return res.status(409).json({ error: "Jenjang tersebut sudah ada" });
      }

      // Simpan ke DB
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

  // --- 2. READ ALL JENJANG (Dipakai Dropdown Topik) ---
  getAllJenjang: async (req, res) => {
    try {
      const jenjangList = await prisma.jenjang.findMany({
        orderBy: { id_jenjang: 'asc' } // Urutkan dari ID kecil (SD -> Kuliah)
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

    try {
      const updatedJenjang = await prisma.jenjang.update({
        where: { id_jenjang: parseInt(id) },
        data: { nama_jenjang, keterangan }
      });

      res.status(200).json({ 
        message: "Jenjang berhasil diupdate", 
        data: updatedJenjang 
      });
    } catch (error) {
      // Handle jika ID tidak ditemukan
      if (error.code === 'P2025') {
        return res.status(404).json({ error: "Jenjang tidak ditemukan" });
      }
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
      // PENTING: Cek error Foreign Key (P2003)
      // Ini terjadi jika Anda mencoba menghapus 'SMA' padahal ada Topik yang pakai 'SMA'
      if (error.code === 'P2003') {
          return res.status(409).json({ 
            error: "Gagal hapus: Jenjang ini sedang digunakan oleh Topik atau data lain." 
          });
      }
      res.status(500).json({ error: "Gagal hapus jenjang" });
    }
  }
};

module.exports = jenjangController;