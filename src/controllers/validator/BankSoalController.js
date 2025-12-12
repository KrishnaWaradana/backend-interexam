const prisma = require('../../config/prismaClient'); 

// 1. GET Dashboard Validator
const getValidatorSoal = async (req, res) => {
  const idValidator = 2; // Testing ID (Natris)

  try {
    const kompetensi = await prisma.kompetensiUser.findMany({
      where: { id_user: idValidator },
      select: { id_subject: true }
    });

    const subjectIds = kompetensi.map(k => k.id_subject);

    if (subjectIds.length === 0) {
      return res.status(200).json({ status: 'success', data: [], message: 'Belum ada kompetensi.' });
    }

    const soalList = await prisma.soal.findMany({
      where: {
        topic: { id_subjects: { in: subjectIds } } 
      },
      orderBy: { id_soal: 'desc' },
      include: {
        contributor: { select: { nama_user: true } },
        topic: { include: { subject: { select: { nama_subject: true } } } } 
      }
    });

    const formattedData = soalList.map((item) => ({
      id_soal: item.id_soal,
      mata_pelajaran: item.topic?.subject?.nama_subject || '-',
      tipe_soal: item.jenis_soal,
      level_kesulitan: item.level_kesulitan,
      status: item.status,
      contributor_name: item.contributor?.nama_user,
      tanggal: item.tanggal_pembuatan
    }));

    res.status(200).json({ status: 'success', data: formattedData });
  } catch (error) {
    console.error("Error getValidatorSoal:", error);
    res.status(500).json({ message: error.message });
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
                topic: { 
                  include: { 
                    subject: true,
                    subTopics: true 
                  } 
                },
                jawaban: true 
            }
        });
        
        if (!soal) return res.status(404).json({ message: 'Soal tidak ditemukan' });
        res.status(200).json({ status: 'success', data: soal });
    } catch (error) {
        console.error("Error getSoalDetail:", error);
        res.status(500).json({ message: error.message });
    }
};

// 3. PUT Validasi
const validateSoal = async (req, res) => {
  const { id } = req.params;
  const { status, keterangan } = req.body; 
  const idValidator = 2; 

  if (!['disetujui', 'ditolak'].includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updatedSoal = await tx.soal.update({
        where: { id_soal: parseInt(id) },
        data: { status: status }
      });

      await tx.validasiSoal.create({
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
    console.error("Error validateSoal:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getValidatorSoal, getSoalDetail, validateSoal };