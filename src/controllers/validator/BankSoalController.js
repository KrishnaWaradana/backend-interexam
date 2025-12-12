const prisma = require('../../config/prismaClient'); 

// 1. GET Dashboard Validator (Filtered by Kompetensi)
const getValidatorSoal = async (req, res) => {
  // ID User Validator
  // Ganti angka 2 dengan ID User Validator asli di database Anda (cek Prisma Studio)
  const idValidator = 2; 

  // (Nyalakan nanti saat Auth sudah jalan):
  // const idValidator = req.user ? req.user.id_user : null;
  // if (!idValidator) return res.status(401).json({ message: "Unauthorized" });

  try {
    // A. Cari Mapel Validator
    const kompetensi = await prisma.kompetensi_user.findMany({
      where: { id_user: idValidator },
      select: { id_subject: true }
    });

    const subjectIds = kompetensi.map(k => k.id_subject);

    if (subjectIds.length === 0) {
      return res.status(200).json({ status: 'success', data: [], message: 'Belum ada kompetensi mapel.' });
    }

    // B. Cari Soal sesuai Mapel
    const soalList = await prisma.soal.findMany({
      where: {
        topics: { id_subjects: { in: subjectIds } }
        // Opsional: status: 'need verification' 
      },
      orderBy: { id_soal: 'desc' },
      include: {
        contributor: { select: { nama_user: true } },
        topics: { include: { subjects: { select: { nama_subject: true } } } }
      }
    });

    // Format Data
    const formattedData = soalList.map((item) => ({
      id_soal: item.id_soal,
      mata_pelajaran: item.topics?.subjects?.nama_subject || '-',
      tipe_soal: item.jenis_soal,
      level_kesulitan: item.level_kesulitan,
      status: item.status,
      contributor_name: item.contributor?.nama_user,
      tanggal: item.tanggal_pembuatan
    }));

    res.status(200).json({ status: 'success', data: formattedData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching validator data' });
  }
};

// 2. GET Detail Soal
const getSoalDetail = async (req, res) => {
    const { id } = req.params;
    try {
        const soal = await prisma.soal.findUnique({
            where: { id_soal: parseInt(id) },
            include: {
                contributor: { select: { nama_user: true } },
                topics: { include: { subjects: true, sub_topics: true } },
                jawaban_soal: true
            }
        });
        if (!soal) return res.status(404).json({ message: 'Soal tidak ditemukan' });
        res.status(200).json({ status: 'success', data: soal });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. PUT Validasi
const validateSoal = async (req, res) => {
  const { id } = req.params;
  const { status, keterangan } = req.body; 
  
  const idValidator = 2; // Ganti dengan ID User Validator yang sama

  if (!['disetujui', 'ditolak'].includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updatedSoal = await tx.soal.update({
        where: { id_soal: parseInt(id) },
        data: { status: status }
      });

      await tx.validasi_soal.create({
        data: {
          id_soal: parseInt(id),
          id_validator: idValidator,
          status: status,
          keterangan: keterangan || null,
          tanggal_validasi: new Date()
        }
      });
      return updatedSoal;
    });

    res.status(200).json({ status: 'success', message: `Soal ${status}`, data: result });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memvalidasi' });
  }
};

module.exports = { getValidatorSoal, getSoalDetail, validateSoal };