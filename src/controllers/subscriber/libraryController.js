const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Get Subscriber Bank Soal
exports.getSubscriberBankSoal = async (req, res) => {
  try {
    const {
      search,
      matapelajaran,
      jenjang,
      level,
      page = 1,
      limit = 10,
    } = req.query;
    const id_subscriber = req.user.id;

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
        include: {
          topic: { include: { subject: true, jenjang: true } },
          favorites: { where: { id_subscriber: id_subscriber } },
        },
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
      is_favorited: item.favorites.length > 0,
    }));

    res.status(200).json({
      status: "success",
      data: formattedData,
      meta: { total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Get Subscriber Favorites
exports.getSubscriberFavorites = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const {
      search,
      matapelajaran,
      jenjang,
      level,
      page = 1,
      limit = 10,
      folderId,
    } = req.query;

    // Build soal where clause
    const soalWhereClause = { status: "disetujui" };
    if (search)
      soalWhereClause.text_soal = { contains: search, mode: "insensitive" };
    if (level && level !== "all")
      soalWhereClause.level_kesulitan = level.toLowerCase();

    if (
      (matapelajaran && matapelajaran !== "all") ||
      (jenjang && jenjang !== "all")
    ) {
      soalWhereClause.topic = {};
      if (matapelajaran && matapelajaran !== "all") {
        const mapelArray = matapelajaran.split(",");
        soalWhereClause.topic.subject = { nama_subject: { in: mapelArray } };
      }
      if (jenjang && jenjang !== "all") {
        soalWhereClause.topic.jenjang = { nama_jenjang: jenjang };
      }
    }

    // Main Where Clause
    const whereClause = {
      id_subscriber: id_subscriber,
      soal: soalWhereClause,
    };

    // --- LOGIKA FILTER FOLDER ---
    if (folderId && folderId !== "null" && folderId !== "undefined") {
      whereClause.id_folder = parseInt(folderId);
    } else if (folderId === "null") {
      whereClause.id_folder = null;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [favoritesList, total] = await prisma.$transaction([
      prisma.favorites.findMany({
        where: whereClause,
        include: {
          soal: {
            include: {
              topic: { include: { subject: true, jenjang: true } },
            },
          },
        },
        skip: skip,
        take: parseInt(limit),
        orderBy: { tanggal: "desc" },
      }),
      prisma.favorites.count({ where: whereClause }),
    ]);

    const formattedData = favoritesList.map((fav) => ({
      id_favorite: fav.id_favorite,
      id_soal: fav.soal.id_soal,
      // Mapping untuk UI Frontend
      question_text: fav.soal.text_soal, // Sesuaikan dengan UI DetailSave
      subject: fav.soal.topic?.subject?.nama_subject || "-",
      jenjang: fav.soal.topic?.jenjang?.nama_jenjang || "-",
      tipe_soal: fav.soal.jenis_soal,
      level: fav.soal.level_kesulitan,
      note: "", // Jika nanti ada fitur note di tabel favorites
      tanggal_disimpan: fav.tanggal,
    }));

    res.status(200).json({
      status: "success",
      data: formattedData,
      meta: { total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Save To Favorites
exports.saveToFavorites = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { id_soal } = req.body;

    if (!id_soal) {
      return res
        .status(400)
        .json({ status: "error", message: "ID soal wajib diisi" });
    }

    // 1. Cek apakah sudah pernah disimpan
    const existingFavorite = await prisma.favorites.findFirst({
      where: {
        id_subscriber: id_subscriber,
        id_soal: parseInt(id_soal),
      },
    });

    if (existingFavorite) {
      return res.status(200).json({
        status: "success",
        message: "Soal sudah ada di favorit",
        data: { id_favorite: existingFavorite.id_favorite },
      });
    }

    // 2. Validasi Soal
    const soal = await prisma.soal.findUnique({
      where: { id_soal: parseInt(id_soal) },
    });

    if (!soal) {
      return res
        .status(404)
        .json({ status: "error", message: "Soal tidak ditemukan" });
    }

    if (soal.status !== "disetujui") {
      return res.status(400).json({
        status: "error",
        message: "Hanya soal yang disetujui yang bisa disimpan",
      });
    }

    // 3. Buat Baru
    const newFavorite = await prisma.favorites.create({
      data: {
        id_subscriber: id_subscriber,
        id_soal: parseInt(id_soal),
        tanggal: new Date(),
      },
    });

    res.status(201).json({
      status: "success",
      message: "Soal berhasil disimpan",
      data: { id_favorite: newFavorite.id_favorite },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Remove Question From Favorites
exports.removeFromFavorites = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { id } = req.params;

    const idFavoriteToDelete = parseInt(id);

    const favorite = await prisma.favorites.findFirst({
      where: {
        id_favorite: idFavoriteToDelete,
        id_subscriber: id_subscriber,
      },
    });

    if (!favorite) {
      return res.status(404).json({
        status: "error",
        message: "Data favorit tidak ditemukan atau bukan milik Anda",
      });
    }

    await prisma.favorites.delete({
      where: { id_favorite: idFavoriteToDelete },
    });

    res.status(200).json({
      status: "success",
      message: "Berhasil dihapus dari favorit",
    });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Toggle Favorite
exports.toggleFavorite = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { id_soal } = req.body;

    if (!id_soal) {
      return res
        .status(400)
        .json({ status: "error", message: "ID soal wajib diisi" });
    }

    const existingFavorite = await prisma.favorites.findFirst({
      where: {
        id_subscriber: id_subscriber,
        id_soal: parseInt(id_soal),
      },
    });

    if (existingFavorite) {
      await prisma.favorites.delete({
        where: { id_favorite: existingFavorite.id_favorite },
      });
      res.status(200).json({
        status: "success",
        message: "Soal dihapus dari favorit",
        data: { is_favorited: false },
      });
    } else {
      const soal = await prisma.soal.findUnique({
        where: { id_soal: parseInt(id_soal) },
      });

      if (!soal) {
        return res
          .status(404)
          .json({ status: "error", message: "Soal tidak ditemukan" });
      }

      if (soal.status !== "disetujui") {
        return res.status(400).json({
          status: "error",
          message: "Hanya soal yang disetujui yang bisa disimpan",
        });
      }

      await prisma.favorites.create({
        data: {
          id_subscriber: id_subscriber,
          id_soal: parseInt(id_soal),
          tanggal: new Date(),
        },
      });

      res.status(201).json({
        status: "success",
        message: "Soal berhasil disimpan",
        data: { is_favorited: true },
      });
    }
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Get All Paket With Progress
exports.getAllPaketsWithProgress = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const {
      search,
      category,
      page = 1,
      limit = 10,
      sortBy = "newest",
    } = req.query;

    const whereClause = { status: "active" };
    if (category && category !== "all") {
      whereClause.category = { nama_category: category };
    }
    if (search) {
      whereClause.nama_paket = { contains: search, mode: "insensitive" };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let orderBy = { tanggal_dibuat: "desc" };

    if (sortBy === "oldest") {
      orderBy = { tanggal_dibuat: "asc" };
    }

    const [pakets, total] = await prisma.$transaction([
      prisma.paketSoal.findMany({
        where: whereClause,
        include: {
          category: true,
          soalPaket: true,
          _count: { select: { paketAttempt: true } },
          paketAttempt: {
            where: { subscribers_id_subscriber: id_subscriber },
            include: { history: { select: { id_jawaban: true } } },
            orderBy: { started_at: "desc" },
            take: 1,
          },
        },
        skip,
        take: parseInt(limit),
        orderBy,
      }),
      prisma.paketSoal.count({ where: whereClause }),
    ]);

    const formattedData = pakets.map((paket) => {
      const totalSoal = paket.soalPaket.length;
      const attempt = paket.paketAttempt[0];
      const answered = attempt ? attempt.history.length : 0;

      return {
        id: paket.id_paket_soal,
        id_paket_soal: paket.id_paket_soal,
        label: paket.nama_paket,
        nama_paket: paket.nama_paket,
        image: paket.image || "/person.jpg",
        progress: { answered, totalSoal },
        participants: paket._count.paketAttempt || 0,
        soal_count: totalSoal,
        totalSoal: totalSoal,
        category: paket.category?.nama_category || "Umum",
      };
    });

    res.status(200).json({
      status: "success",
      data: formattedData,
      meta: { total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// CreateFolder
exports.createFolder = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { nama_folder, keterangan } = req.body;

    if (!nama_folder) {
      return res
        .status(400)
        .json({ status: "error", message: "Nama folder wajib diisi" });
    }

    const newFolder = await prisma.folders.create({
      data: {
        nama_folder,
        keterangan,
        id_subscriber,
      },
    });

    res.status(201).json({
      status: "success",
      message: "Folder berhasil dibuat",
      data: newFolder,
    });
  } catch (error) {
    console.error("Create Folder Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 2. Get My Folders (Menampilkan semua folder milik user)
exports.getMyFolders = async (req, res) => {
  try {
    const id_subscriber = req.user.id;

    const folders = await prisma.folders.findMany({
      where: { id_subscriber },
      include: {
        _count: {
          select: { favorites: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const formattedData = folders.map((f) => ({
      id: f.id_folder,
      nama: f.nama_folder,
      keterangan: f.keterangan || "",
      total_item: f._count.favorites,
      created_at: f.created_at,
    }));

    res.status(200).json({
      status: "success",
      data: formattedData,
    });
  } catch (error) {
    console.error("Get Folders Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 3. Delete Folder
exports.deleteFolder = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { id } = req.params;

    // Cek kepemilikan folder
    const folder = await prisma.folders.findFirst({
      where: {
        id_folder: parseInt(id),
        id_subscriber,
      },
    });

    if (!folder) {
      return res
        .status(404)
        .json({ status: "error", message: "Folder tidak ditemukan" });
    }

    // Hapus folder
    await prisma.folders.delete({
      where: { id_folder: parseInt(id) },
    });

    res.status(200).json({
      status: "success",
      message: "Folder berhasil dihapus",
    });
  } catch (error) {
    console.error("Delete Folder Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 4. Add To Folder (Memindahkan Favorit ke Folder)
exports.addToFolder = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { id_favorite, id_folder } = req.body;

    // Validasi kepemilikan Favorit
    const favorite = await prisma.favorites.findFirst({
      where: { id_favorite: parseInt(id_favorite), id_subscriber },
    });

    if (!favorite) {
      return res
        .status(404)
        .json({ status: "error", message: "Item favorit tidak ditemukan" });
    }

    // Validasi kepemilikan Folder (Jika id_folder ada)
    if (id_folder) {
      const folder = await prisma.folders.findFirst({
        where: { id_folder: parseInt(id_folder), id_subscriber },
      });
      if (!folder) {
        return res
          .status(404)
          .json({ status: "error", message: "Folder tidak ditemukan" });
      }
    }

    // Update Favorit
    await prisma.favorites.update({
      where: { id_favorite: parseInt(id_favorite) },
      data: { id_folder: id_folder ? parseInt(id_folder) : null }, // null = keluarkan dari folder
    });

    res.status(200).json({
      status: "success",
      message: id_folder
        ? "Berhasil dipindahkan ke folder"
        : "Berhasil dikeluarkan dari folder",
    });
  } catch (error) {
    console.error("Add to Folder Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};
