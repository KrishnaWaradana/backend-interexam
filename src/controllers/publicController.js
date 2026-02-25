const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getDemoPackages = async (req, res) => {
  try {
    // Gunakan findMany untuk mengambil SEMUA paket yang gratis
    const demoPakets = await prisma.paketSoal.findMany({
      where: {
        jenis: "gratis",
        status: "active",
      },
      include: {
        category: true,
        soalPaket: {
          orderBy: { id_soal_paket_soal: "asc" },
          take: 10, // KITA LANGSUNG BATASI 10 SOAL DI DATABASE BIAR RINGAN!
          include: {
            soal: {
              include: {
                attachments: true,
                jawaban: {
                  select: {
                    id_jawaban: true,
                    opsi_jawaban_text: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!demoPakets || demoPakets.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Belum ada paket demo yang tersedia.",
      });
    }

    // Format datanya menjadi array
    const formattedData = demoPakets.map((paket) => ({
      id_paket: paket.id_paket_soal,
      nama_paket: paket.nama_paket,
      deskripsi: paket.deskripsi,
      image: paket.image,
      durasi: paket.durasi || 15,
      soal: paket.soalPaket.map((sp, index) => ({
        no_soal: index + 1,
        id_soal: sp.soal.id_soal,
        text_soal: sp.soal.text_soal,
        jenis_soal: sp.soal.jenis_soal,
        attachments: sp.soal.attachments,
        opsi_jawaban: sp.soal.jawaban.map((j) => ({
          id_jawaban: j.id_jawaban,
          teks: j.opsi_jawaban_text,
          is_correct: j.status === true,
        })),
      })),
    }));

    res.status(200).json({
      status: "success",
      data: formattedData,
    });
  } catch (error) {
    console.error("Get Demo Packages Error:", error);
    res
      .status(500)
      .json({ status: "error", message: "Terjadi kesalahan server." });
  }
};
