const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const fs = require("fs");
const path = require("path");

// HELPER DELETE FILE
const deleteFileHelper = (filePath) => {
  if (!filePath) return;
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(global.__basedir, "../", filePath);
  if (fs.existsSync(absolutePath)) {
    try {
      fs.unlinkSync(absolutePath);
    } catch (e) {}
  }
};

// 1. GET ALL PAKET
exports.getAllPaket = async (req, res) => {
  try {
    const paketList = await prisma.paketSoal.findMany({
      orderBy: { id_paket_soal: "desc" },
      include: {
        category: true,
        _count: {
          select: { soalPaket: true },
        },
      },
    });
    res.status(200).json({ status: "success", data: paketList });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data paket soal." });
  }
};

// 2. GET DETAIL PAKET (Untuk Edit & Tampil Soal - SUDAH FIX)
exports.getPaketDetail = async (req, res) => {
  const { id } = req.params;
  try {
    const paket = await prisma.paketSoal.findUnique({
      where: { id_paket_soal: parseInt(id) },
      include: {
        category: true,
        soalPaket: {
          include: {
            soal: {
              include: {
                topic: { include: { subject: true, jenjang: true } },
                jawaban: {
                  orderBy: { id_jawaban: "asc" },
                },
              },
            },
          },
          orderBy: { id_soal_paket_soal: "asc" },
        },
      },
    });

    if (!paket)
      return res.status(404).json({ message: "Paket soal tidak ditemukan." });

    // Mapping Data untuk Frontend
    const responseData = {
      id_paket_soal: paket.id_paket_soal,
      nama_paket: paket.nama_paket,
      deskripsi: paket.deskripsi,
      image: paket.image,
      jenis: paket.jenis,
      status: paket.status,
      id_category: paket.id_category,
      category: paket.category?.nama_category,
      soal_paket_soal: paket.soalPaket.map((sp) => ({
        id_soal_paket_soal: sp.id_soal_paket_soal,
        id_soal: sp.id_soal,
        id_paket_soal: sp.id_paket_soal,
        point: sp.point,
        durasi: sp.durasi,
        soal: {
          id_soal: sp.soal.id_soal,
          text_soal: sp.soal.text_soal,
          jenis_soal: sp.soal.jenis_soal,
          level_kesulitan: sp.soal.level_kesulitan,
          option_a: sp.soal.jawaban[0]?.opsi_jawaban_text || "",
          option_b: sp.soal.jawaban[1]?.opsi_jawaban_text || "",
          option_c: sp.soal.jawaban[2]?.opsi_jawaban_text || "",
          option_d: sp.soal.jawaban[3]?.opsi_jawaban_text || "",
          option_e: sp.soal.jawaban[4]?.opsi_jawaban_text || "",
          jawaban_benar: getCorrectAnswer(sp.soal.jawaban),
          deskripsi: sp.soal.jawaban[0]?.pembahasan || "",
          topic: sp.soal.topic?.nama_topics,
          subject: sp.soal.topic?.subject?.nama_subject,
          jenjang: sp.soal.topic?.jenjang?.nama_jenjang,
        },
      })),
    };

    res.status(200).json({ status: "success", data: responseData });
  } catch (error) {
    console.error("Error Detail:", error);
    res.status(500).json({ message: error.message });
  }
};

// Helper function untuk mendapatkan jawaban yang benar
const getCorrectAnswer = (jawaban) => {
  const correctAnswerObj = jawaban.find((j) => j.status === true);
  if (!correctAnswerObj) return "a";
  const index = jawaban.indexOf(correctAnswerObj);
  return String.fromCharCode(97 + index); // 97 = 'a' dalam ASCII
};

// 3. GET BANK SOAL (INI PERBAIKAN AGAR DATA MUNCUL DI OVERLAY)
exports.getBankSoal = async (req, res) => {
  try {
    const {
      search,
      matapelajaran,
      jenjang,
      level,
      page = 1,
      limit = 10,
    } = req.query;
    const whereClause = { status: "disetujui" };

    if (search)
      whereClause.text_soal = { contains: search, mode: "insensitive" };
    if (level && level !== "all")
      whereClause.level_kesulitan = level.toLowerCase();

    if (
      (matapelajaran && matapelajaran !== "all") ||
      (jenjang && jenjang !== "all")
    ) {
      whereClause.topic = {};
      if (matapelajaran && matapelajaran !== "all") {
        const mapelArray = matapelajaran.split(",");
        whereClause.topic.subject = { nama_subject: { in: mapelArray } };
      }
      if (jenjang && jenjang !== "all")
        whereClause.topic.jenjang = { nama_jenjang: jenjang };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [soalList, total] = await prisma.$transaction([
      prisma.soal.findMany({
        where: whereClause,
        include: { topic: { include: { subject: true, jenjang: true } } },
        skip: skip,
        take: parseInt(limit),
        orderBy: { id_soal: "desc" },
      }),
      prisma.soal.count({ where: whereClause }),
    ]);

    // [MAPPING PENTING] Frontend minta 'nama_soal', DB punya 'text_soal'
    const formattedData = soalList.map((item) => ({
      id: item.id_soal,
      nama_soal: item.text_soal,
      matapelajaran: item.topic?.subject?.nama_subject || "-",
      jenjang: item.topic?.jenjang?.nama_jenjang || "-",
      tipe_soal: item.jenis_soal,
      level: item.level_kesulitan,
      status: "Disetujui",
    }));

    res
      .status(200)
      .json({ data: formattedData, meta: { total, page: parseInt(page) } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. CREATE PAKET
exports.createPaketSoal = async (req, res) => {
  const file = req.file;
  const { nama_paket, deskripsi, jenis, status, id_category, soal_ids } =
    req.body;
  const id_creator = req.user.id;

  try {
    let parsedSoalIds = [];
    if (soal_ids) parsedSoalIds = JSON.parse(soal_ids);

    let jenisDb =
      jenis === "try_out" || jenis === "Berbayar" ? "try_out" : "latihan";
    let statusDb = status ? status.toLowerCase() : "draft";
    const categoryInt = parseInt(id_category);

    const result = await prisma.$transaction(async (tx) => {
      const newPaket = await tx.paketSoal.create({
        data: {
          nama_paket,
          deskripsi,
          jenis: jenisDb,
          status: statusDb,
          image: file ? file.path : null,
          jumlah_soal: parsedSoalIds.length,
          id_category: categoryInt,
          id_creator,
          tanggal_dibuat: new Date(),
        },
      });
      if (parsedSoalIds.length > 0) {
        const soalPaketData = parsedSoalIds.map((soalId) => ({
          id_paket_soal: newPaket.id_paket_soal,
          id_soal: parseInt(soalId),
          point: 100 / parsedSoalIds.length,
        }));
        await tx.soalPaketSoal.createMany({ data: soalPaketData });
      }
      return newPaket;
    });
    res
      .status(201)
      .json({ message: "Paket soal berhasil dibuat!", data: result });
  } catch (error) {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(500).json({ message: error.message });
  }
};

// 5. UPDATE PAKET (SUDAH FIX LOGIKA JENIS)
exports.updatePaket = async (req, res) => {
  const { id } = req.params;
  const file = req.file;
  const { nama_paket, deskripsi, jenis, status, id_category, soal_ids } =
    req.body;

  try {
    const existingPaket = await prisma.paketSoal.findUnique({
      where: { id_paket_soal: parseInt(id) },
    });
    if (!existingPaket) {
      if (file) fs.unlinkSync(file.path);
      return res.status(404).json({ message: "Paket tidak ditemukan" });
    }

    let parsedSoalIds = [];
    if (soal_ids) parsedSoalIds = JSON.parse(soal_ids);

    // Logic Update Jenis
    let jenisDb = undefined;
    if (jenis) {
      jenisDb =
        jenis === "try_out" || jenis === "Berbayar" ? "try_out" : "latihan";
    }

    let statusDb = undefined;
    if (status) statusDb = status.toLowerCase();
    const categoryInt = id_category ? parseInt(id_category) : undefined;

    await prisma.$transaction(async (tx) => {
      const updateData = {
        nama_paket,
        deskripsi,
        jumlah_soal: parsedSoalIds.length,
      };
      if (jenisDb) updateData.jenis = jenisDb;
      if (statusDb) updateData.status = statusDb;
      if (categoryInt) updateData.id_category = categoryInt;
      if (file) {
        updateData.image = file.path;
        deleteFileHelper(existingPaket.image);
      }

      await tx.paketSoal.update({
        where: { id_paket_soal: parseInt(id) },
        data: updateData,
      });

      if (parsedSoalIds.length > 0) {
        await tx.soalPaketSoal.deleteMany({
          where: { id_paket_soal: parseInt(id) },
        });
        const soalPaketData = parsedSoalIds.map((soalId) => ({
          id_paket_soal: parseInt(id),
          id_soal: parseInt(soalId),
          point: 100 / parsedSoalIds.length,
        }));
        await tx.soalPaketSoal.createMany({ data: soalPaketData });
      }
    });
    res
      .status(200)
      .json({ status: "success", message: "Paket berhasil diupdate." });
  } catch (error) {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(500).json({ message: error.message });
  }
};

// 6. DELETE PAKET
exports.deletePaket = async (req, res) => {
  const { id } = req.params;
  try {
    const paket = await prisma.paketSoal.findUnique({
      where: { id_paket_soal: parseInt(id) },
    });
    if (!paket)
      return res.status(404).json({ message: "Paket tidak ditemukan." });
    if (paket.image) deleteFileHelper(paket.image);

    await prisma.$transaction(async (tx) => {
      await tx.soalPaketSoal.deleteMany({
        where: { id_paket_soal: parseInt(id) },
      });
      await tx.paketSoal.delete({ where: { id_paket_soal: parseInt(id) } });
    });
    res
      .status(200)
      .json({ status: "success", message: "Paket soal berhasil dihapus." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
