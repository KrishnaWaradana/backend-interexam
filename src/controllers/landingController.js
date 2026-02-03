// apps/backend/controllers/landingController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getPublicPackages = async (req, res) => {
  try {
    const { search, category, limit = 100 } = req.query;
    const whereClause = { status: "active" };

    if (category && category !== "all") {
      whereClause.category = { nama_category: category };
    }
    if (search) {
      whereClause.nama_paket = { contains: search, mode: "insensitive" };
    }

    const pakets = await prisma.paketSoal.findMany({
      where: whereClause,
      include: {
        category: true,
        // OPTIMASI: Jangan ambil "soalPaket: true" (berat), pakai _count saja
        _count: {
          select: {
            paketAttempt: true,
            soalPaket: true, // Hitung jumlah soal langsung di database
          },
        },
      },
      orderBy: { tanggal_dibuat: "desc" },
      take: parseInt(limit),
    });

    const formattedData = pakets.map((paket) => ({
      id: paket.id_paket_soal,
      label: paket.nama_paket,
      description: paket.deskripsi,
      image: paket.image || "/person.jpg",
      totalSoal: paket._count.soalPaket || 0,
      participants: paket._count.paketAttempt || 0,
      category: paket.category?.nama_category || "Umum",
      rating: 4.8,
    }));

    res.status(200).json({
      status: "success",
      data: formattedData,
    });
  } catch (error) {
    console.error("Public Packages Error:", error);
    res
      .status(500)
      .json({ status: "error", message: "Gagal memuat paket soal." });
  }
};
