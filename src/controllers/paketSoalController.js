const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const fs = require("fs");
const path = require("path");

// HELPER: DELETE FILE
const deleteFileHelper = (filePath) => {
  if (!filePath) return;
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(global.__basedir || process.cwd(), filePath);
  if (fs.existsSync(absolutePath)) {
    try { fs.unlinkSync(absolutePath); } catch (e) { console.error(e); }
  }
};

// 1. GET ALL PAKET
exports.getAllPaket = async (req, res) => {
  try {
    const paketList = await prisma.paketSoal.findMany({
      orderBy: { id_paket_soal: "desc" },
      include: {
        category: true, 
        _count: { select: { soalPaket: true } },
      },
    });
    res.status(200).json({ status: "success", data: paketList });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data paket soal." });
  }
};

// 2. GET DETAIL PAKET
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
                jawaban: { orderBy: { id_jawaban: "asc" } },
              },
            },
          },
          orderBy: { id_soal_paket_soal: "asc" },
        },
      },
    });

    if (!paket) return res.status(404).json({ message: "Paket tidak ditemukan." });

    const responseData = {
      id_paket_soal: paket.id_paket_soal,
      nama_paket: paket.nama_paket,
      deskripsi: paket.deskripsi,
      image: paket.image,
      jenis: paket.jenis, // Output: "gratis" atau "berbayar"
      status: paket.status,
      id_category: paket.id_category,
      category: paket.category?.nama_category || "-", // Handle jika null
      
      soal_paket_soal: paket.soalPaket.map((sp) => ({
        id_soal_paket_soal: sp.id_soal_paket_soal,
        id_soal: sp.id_soal,
        point: sp.point,
        durasi: sp.durasi,
        soal: {
          id_soal: sp.soal.id_soal,
          text_soal: sp.soal.text_soal,
          jenis_soal: sp.soal.jenis_soal,
          level_kesulitan: sp.soal.level_kesulitan,
          jawaban_benar: getCorrectAnswer(sp.soal.jawaban),
          topic: sp.soal.topic?.nama_topics,
          subject: sp.soal.topic?.subject?.nama_subject,
          jenjang: sp.soal.topic?.jenjang?.nama_jenjang,
        },
      })),
    };

    res.status(200).json({ status: "success", data: responseData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCorrectAnswer = (jawaban) => {
  const obj = jawaban.find((j) => j.status === true);
  return obj ? String.fromCharCode(97 + jawaban.indexOf(obj)) : "a";
};

// 3. GET BANK SOAL (Tetap sama)
exports.getBankSoal = async (req, res) => {
  try {
    const { search, matapelajaran, jenjang, level, page = 1, limit = 10 } = req.query;
    const whereClause = { status: "disetujui" };

    if (search) whereClause.text_soal = { contains: search, mode: "insensitive" };
    if (level && level !== "all") whereClause.level_kesulitan = level.toLowerCase();

    if ((matapelajaran && matapelajaran !== "all") || (jenjang && jenjang !== "all")) {
      whereClause.topic = {};
      if (matapelajaran && matapelajaran !== "all") {
        whereClause.topic.subject = { nama_subject: { in: matapelajaran.split(",") } };
      }
      if (jenjang && jenjang !== "all") whereClause.topic.jenjang = { nama_jenjang: jenjang };
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

    const formattedData = soalList.map((item) => ({
      id: item.id_soal,
      nama_soal: item.text_soal,
      matapelajaran: item.topic?.subject?.nama_subject || "-",
      jenjang: item.topic?.jenjang?.nama_jenjang || "-",
      tipe_soal: item.jenis_soal,
      level: item.level_kesulitan,
      status: "Disetujui",
    }));

    res.status(200).json({ data: formattedData, meta: { total, page: parseInt(page) } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. CREATE PAKET SOAL (LOGIC BARU: Kategori Optional)
exports.createPaketSoal = async (req, res) => {
  const file = req.file;
  
  // Auth Check
  const id_creator = req.user && req.user.id ? parseInt(req.user.id) : null;
  if (!id_creator) {
     if (file) fs.unlinkSync(file.path);
     return res.status(401).json({ message: "Unauthorized: ID User tidak ditemukan." });
  }

  const { nama_paket, deskripsi, jenis, status, id_category, soal_ids } = req.body;

  try {
    let parsedSoalIds = [];
    if (soal_ids) parsedSoalIds = typeof soal_ids === 'string' ? JSON.parse(soal_ids) : soal_ids;

    // 1. Logic Jenis (Langsung Mapping ke Enum Baru: gratis / berbayar)
    let jenisDb = "gratis"; 
    if (jenis) {
        const input = jenis.toLowerCase();
        // Frontend kirim "Berbayar" -> DB: berbayar
        // Frontend kirim "Gratis" -> DB: gratis
        if (input === "berbayar" || input === "try_out") jenisDb = "berbayar";
        else jenisDb = "gratis";
    }

    // 2. Logic Status
    let statusDb = "draft";
    if (status && ["active", "inactive", "draft"].includes(status.toLowerCase())) {
        statusDb = status.toLowerCase();
    }

    // 3. Logic Kategori (OPTIONAL)
    // Jika id_category kosong/undefined, categoryInt akan null
    const categoryInt = id_category ? parseInt(id_category) : null;

    const result = await prisma.$transaction(async (tx) => {
      
      // Siapkan object data untuk create
      const createData = {
          nama_paket,
          deskripsi,
          jenis: jenisDb,
          status: statusDb,
          image: file ? file.path : null,
          jumlah_soal: parsedSoalIds.length,
          tanggal_dibuat: new Date(),
          creator: { connect: { id_user: id_creator } }
      };

      // HANYA CONNECT KATEGORI JIKA USER MEMILIH KATEGORI
      if (categoryInt) {
          createData.category = { connect: { id_category: categoryInt } };
      }

      const newPaket = await tx.paketSoal.create({
        data: createData
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

    res.status(201).json({ message: "Paket soal berhasil dibuat!", data: result });

  } catch (error) {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    console.error("Create Paket Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// 5. UPDATE PAKET SOAL (Support Remove Category)
exports.updatePaket = async (req, res) => {
  const { id } = req.params;
  const file = req.file;
  const { nama_paket, deskripsi, jenis, status, id_category, soal_ids } = req.body;

  try {
    const existingPaket = await prisma.paketSoal.findUnique({
      where: { id_paket_soal: parseInt(id) },
    });

    if (!existingPaket) {
      if (file) fs.unlinkSync(file.path);
      return res.status(404).json({ message: "Paket tidak ditemukan" });
    }

    let parsedSoalIds = [];
    if (soal_ids) parsedSoalIds = typeof soal_ids === 'string' ? JSON.parse(soal_ids) : soal_ids;

    let updateData = {
        nama_paket,
        deskripsi,
        jumlah_soal: parsedSoalIds.length,
    };

    if (jenis) {
        const input = jenis.toLowerCase();
        if (input === "berbayar" || input === "try_out") updateData.jenis = "berbayar";
        else updateData.jenis = "gratis";
    }

    if (status && ["active", "inactive", "draft"].includes(status.toLowerCase())) {
        updateData.status = status.toLowerCase();
    }

    // LOGIC UPDATE KATEGORI
    // 1. Jika ada ID kategori baru -> Connect
    if (id_category) {
        updateData.category = { connect: { id_category: parseInt(id_category) } };
    } 
    // 2. Jika dikirim null/string kosong (artinya user menghapus kategori) -> Disconnect
    else if (id_category === null || id_category === "") {
        updateData.category = { disconnect: true };
    }

    await prisma.$transaction(async (tx) => {
      if (file) {
        updateData.image = file.path;
        deleteFileHelper(existingPaket.image);
      }

      await tx.paketSoal.update({
        where: { id_paket_soal: parseInt(id) },
        data: updateData,
      });

      if (soal_ids) {
        await tx.soalPaketSoal.deleteMany({ where: { id_paket_soal: parseInt(id) } });
        if (parsedSoalIds.length > 0) {
            const soalPaketData = parsedSoalIds.map((soalId) => ({
                id_paket_soal: parseInt(id),
                id_soal: parseInt(soalId),
                point: 100 / parsedSoalIds.length,
            }));
            await tx.soalPaketSoal.createMany({ data: soalPaketData });
        }
      }
    });

    res.status(200).json({ status: "success", message: "Paket berhasil diupdate." });

  } catch (error) {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(500).json({ message: error.message });
  }
};

// 6. DELETE PAKET (Sama)
exports.deletePaket = async (req, res) => {
  const { id } = req.params;
  try {
    const paket = await prisma.paketSoal.findUnique({
      where: { id_paket_soal: parseInt(id) },
    });
    if (!paket) return res.status(404).json({ message: "Paket tidak ditemukan." });
    
    if (paket.image) deleteFileHelper(paket.image);

    await prisma.$transaction(async (tx) => {
      await tx.soalPaketSoal.deleteMany({ where: { id_paket_soal: parseInt(id) } });
      await tx.paketAttempt.deleteMany({ where: { paket_soal_id_paket_soal: parseInt(id) } });
      await tx.paketSoal.delete({ where: { id_paket_soal: parseInt(id) } });
    });
    
    res.status(200).json({ status: "success", message: "Paket soal berhasil dihapus." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};