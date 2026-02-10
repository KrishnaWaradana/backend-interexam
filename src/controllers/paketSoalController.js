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
        category: true, // Bisa null sekarang
        _count: { select: { soalPaket: true } },
      },
    });
    
    // Mapping agar Frontend menerima string "Gratis"/"Berbayar" saat GET
    const formattedData = paketList.map(paket => ({
        ...paket,
        // Balikkan logic: latihan -> Gratis, try_out -> Berbayar
        jenis_label: paket.jenis === 'try_out' ? 'Berbayar' : 'Gratis' 
    }));

    res.status(200).json({ status: "success", data: formattedData });
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
      
      // LOGIC MAPPING OUTPUT KE FRONTEND
      // Database: latihan  -> Frontend: Gratis
      // Database: try_out  -> Frontend: Berbayar
      jenis: paket.jenis === 'try_out' ? 'Berbayar' : 'Gratis',
      
      status: paket.status,
      id_category: paket.id_category, // Bisa null
      category: paket.category?.nama_category || "Event / Tanpa Kategori",
      
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
    res.status(500).json({ message: error.message });
  }
};

const getCorrectAnswer = (jawaban) => {
  const obj = jawaban.find((j) => j.status === true);
  return obj ? String.fromCharCode(97 + jawaban.indexOf(obj)) : "a";
};

// 3. GET BANK SOAL
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

// 4. CREATE PAKET SOAL (SIMPLIFIED LOGIC)
exports.createPaketSoal = async (req, res) => {
  const file = req.file;
  // Ambil ID dari req.user.id (sesuai auth Anda)
  const id_creator = req.user && req.user.id ? parseInt(req.user.id) : null;

  if (!id_creator) {
     if (file) fs.unlinkSync(file.path);
     return res.status(401).json({ message: "Unauthorized: ID User tidak ditemukan." });
  }

  // Frontend mengirim "jenis" berisi "Gratis" atau "Berbayar"
  const { nama_paket, deskripsi, jenis, status, id_category, soal_ids } = req.body;

  try {
    let parsedSoalIds = [];
    if (soal_ids) parsedSoalIds = typeof soal_ids === 'string' ? JSON.parse(soal_ids) : soal_ids;

    // --- LOGIC MAPPING UTAMA ---
    // Frontend: "Gratis"   -> Database: "latihan"
    // Frontend: "Berbayar" -> Database: "try_out"
    
    let jenisDb = "latihan"; // Default = Gratis
    if (jenis) {
        const input = jenis.toLowerCase();
        if (input === "berbayar" || input === "try_out") {
            jenisDb = "try_out";
        } else {
            jenisDb = "latihan"; // Handle "gratis" atau "latihan"
        }
    }

    let statusDb = "draft";
    if (status && ["active", "inactive", "draft"].includes(status.toLowerCase())) {
        statusDb = status.toLowerCase();
    }

    // Category Opsional (Bisa null/undefined)
    const categoryInt = id_category ? parseInt(id_category) : null;

    const result = await prisma.$transaction(async (tx) => {
      // Siapkan object connect category hanya jika ada isinya
      let categoryConnect = {};
      if (categoryInt) {
          categoryConnect = { category: { connect: { id_category: categoryInt } } };
      }

      const newPaket = await tx.paketSoal.create({
        data: {
          nama_paket,
          deskripsi,
          jenis: jenisDb,    // try_out (berbayar) atau latihan (gratis)
          status: statusDb,
          image: file ? file.path : null,
          jumlah_soal: parsedSoalIds.length,
          tanggal_dibuat: new Date(),
          
          ...categoryConnect, // Spread operator: kalau null, tidak akan membuat relasi
          
          creator: {
            connect: { id_user: id_creator }
          }
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

    res.status(201).json({ message: "Paket soal berhasil dibuat!", data: result });

  } catch (error) {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    console.error("Create Paket Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// 5. UPDATE PAKET SOAL
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

    // Mapping Update
    if (jenis) {
        const input = jenis.toLowerCase();
        // Jika input "berbayar" atau "try_out" -> set Try Out
        if (input === "berbayar" || input === "try_out") updateData.jenis = "try_out";
        // Jika input "gratis" atau "latihan" -> set Latihan
        else updateData.jenis = "latihan";
    }

    if (status && ["active", "inactive", "draft"].includes(status.toLowerCase())) {
        updateData.status = status.toLowerCase();
    }

    // Handle Kategori Opsional
    if (id_category) {
        updateData.category = { connect: { id_category: parseInt(id_category) } };
    } 
    // Jika user ingin menghapus kategori (dikirim null atau "null")
    else if (id_category === null || id_category === "null") {
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

// 6. DELETE PAKET
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