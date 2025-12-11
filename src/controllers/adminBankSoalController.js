const prisma = require('../config/prismaClient'); 

// 1. GET All Soal (Admin Global)
const getAllSoal = async (req, res) => {
  try {
    const soalList = await prisma.soal.findMany({
      orderBy: { id_soal: 'desc' },
      include: {
        contributor: { select: { nama_user: true } },
        topics: { include: { subjects: { select: { nama_subject: true } } } }
      }
    });

    const formattedData = soalList.map((item) => ({
      id_soal: item.id_soal,
      mata_pelajaran: item.topics?.subjects?.nama_subject || '-',
      tipe_soal: item.jenis_soal,     
      level_kesulitan: item.level_kesulitan,
      status: item.status,            
      contributor_name: item.contributor?.nama_user || 'Unknown',
      tanggal: item.tanggal_pembuatan
    }));

    res.status(200).json({ status: 'success', data: formattedData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 2. PUT Validasi (Admin Override)
const validateSoalAdmin = async (req, res) => {
  const { id } = req.params;
  const { status, keterangan } = req.body; 
  const idAdmin = req.user ? req.user.id_user : 1; 

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updatedSoal = await tx.soal.update({
        where: { id_soal: parseInt(id) },
        data: { status: status } 
      });

      await tx.validasi_soal.create({
        data: {
          id_soal: parseInt(id),
          id_validator: idAdmin,
          status: status, 
          keterangan: keterangan || `Validasi Admin: ${status}`,
          tanggal_validasi: new Date()
        }
      });
      return updatedSoal;
    });

    res.status(200).json({ msg: `Soal berhasil ${status}`, data: result });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memvalidasi' });
  }
};

module.exports = { getAllSoal, validateSoalAdmin };