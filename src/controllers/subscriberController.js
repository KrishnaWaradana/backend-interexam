const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// 1. GET BANK SOAL UNTUK SUBSCRIBER (untuk halaman Simpan)
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

    // Ambil soal dan cek apakah sudah difavoritkan
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

    // Format response dengan status favorit
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

// 2. GET FAVORIT SOAL (LIST SOAL YANG SUDAH DISIMPAN)
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

    const whereClause = {
      id_subscriber: id_subscriber,
      soal: soalWhereClause,
    };

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
      nama_soal: fav.soal.text_soal,
      matapelajaran: fav.soal.topic?.subject?.nama_subject || "-",
      jenjang: fav.soal.topic?.jenjang?.nama_jenjang || "-",
      tipe_soal: fav.soal.jenis_soal,
      level: fav.soal.level_kesulitan,
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

// 3. SAVE SOAL KE FAVORITES
exports.saveToFavorites = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { id_soal } = req.body;

    if (!id_soal) {
      return res
        .status(400)
        .json({ status: "error", message: "ID soal wajib diisi" });
    }

    // Cek apakah soal sudah ada di favorites
    const existingFavorite = await prisma.favorites.findFirst({
      where: {
        id_subscriber: id_subscriber,
        id_soal: parseInt(id_soal),
      },
    });

    if (existingFavorite) {
      return res.status(400).json({
        status: "error",
        message: "Soal ini sudah ada di daftar favorit Anda",
      });
    }

    // Cek apakah soal ada dan disetujui
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

    // Simpan ke favorites
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

// 4. HAPUS SOAL DARI FAVORITES
exports.removeFromFavorites = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { id_soal } = req.params;

    // Cek apakah soal ada di favorites subscriber
    const favorite = await prisma.favorites.findFirst({
      where: {
        id_subscriber: id_subscriber,
        id_soal: parseInt(id_soal),
      },
    });

    if (!favorite) {
      return res.status(404).json({
        status: "error",
        message: "Soal tidak ditemukan di daftar favorit",
      });
    }

    // Hapus dari favorites
    await prisma.favorites.delete({
      where: { id_favorite: favorite.id_favorite },
    });

    res.status(200).json({
      status: "success",
      message: "Soal berhasil dihapus dari favorit",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 5. TOGGLE FAVORITE (SIMPAN/HAPUS)
exports.toggleFavorite = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { id_soal } = req.body;

    if (!id_soal) {
      return res
        .status(400)
        .json({ status: "error", message: "ID soal wajib diisi" });
    }

    // Cek apakah sudah ada di favorites
    const existingFavorite = await prisma.favorites.findFirst({
      where: {
        id_subscriber: id_subscriber,
        id_soal: parseInt(id_soal),
      },
    });

    if (existingFavorite) {
      // Jika sudah ada, hapus
      await prisma.favorites.delete({
        where: { id_favorite: existingFavorite.id_favorite },
      });
      res.status(200).json({
        status: "success",
        message: "Soal dihapus dari favorit",
        data: { is_favorited: false },
      });
    } else {
      // Jika belum ada, simpan
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

// 6. GET RECENT PAKETS (untuk dashboard home - 4 paket terbaru dengan progress)
exports.getRecentPakets = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const limit = 4; // Ambil 4 paket terbaru

    const recentPakets = await prisma.paketSoal.findMany({
      where: { status: "active" },
      include: {
        category: true,
        soalPaket: {
          include: {
            soal: true,
          },
        },
        paketAttempt: {
          where: { subscribers_id_subscriber: id_subscriber },
          include: {
            history: {
              select: { id_jawaban: true },
            },
          },
          orderBy: { started_at: "desc" },
          take: 1,
        },
      },
      orderBy: { tanggal_dibuat: "desc" },
      take: limit,
    });

    const formattedData = recentPakets.map((paket) => {
      const totalSoal = paket.soalPaket.length;
      const attempt = paket.paketAttempt[0];
      const answered = attempt ? attempt.history.length : 0;

      return {
        id: paket.id_paket_soal,
        label: paket.nama_paket,
        image: paket.image || "/person.jpg",
        progress: { answered, totalSoal },
        category: paket.category?.nama_category || "Umum",
      };
    });

    res.status(200).json({
      status: "success",
      data: formattedData,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 7. GET STATISTICS SUMMARY (untuk dashboard - total ujian, skor rata-rata, waktu belajar)
exports.getStatisticsSummary = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total ujian selesai
    const totalExams = await prisma.paketAttempt.count({
      where: {
        subscribers_id_subscriber: id_subscriber,
        finished_at: { not: null },
      },
    });

    // Ujian minggu ini
    const examsThisWeek = await prisma.paketAttempt.count({
      where: {
        subscribers_id_subscriber: id_subscriber,
        finished_at: { gte: weekAgo },
      },
    });

    // Rata-rata skor (simulasi: 75% dari complete attempts)
    const completedAttempts = await prisma.paketAttempt.findMany({
      where: {
        subscribers_id_subscriber: id_subscriber,
        finished_at: { not: null },
      },
      include: {
        paketSoal: {
          include: { soalPaket: true },
        },
        history: true,
      },
      take: 10,
    });

    let avgScore = 0;
    if (completedAttempts.length > 0) {
      const scores = completedAttempts.map((attempt) => {
        const totalQuestions = attempt.paketSoal.soalPaket.length || 1;
        const correctAnswers = attempt.history.length;
        return (correctAnswers / totalQuestions) * 100;
      });
      avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    // Total waktu belajar (dari history)
    const historyRecords = await prisma.historyPengerjaanPaket.findMany({
      where: { id_subscriber: id_subscriber },
      select: { tanggal: true },
    });

    const totalMinutes = Math.round((historyRecords.length * 5) / 60); // Simulasi 5 menit per soal
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    res.status(200).json({
      status: "success",
      data: {
        totalExams,
        examsTrend: `+${Math.max(0, examsThisWeek - 2)}`,
        avgScore,
        scoreTrend: "+5%",
        studyTime: `${hours}j ${minutes}m`,
        timeTrend: "+20m",
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 8. GET STREAK & WEEKLY TARGET (untuk dashboard - rekor belajar mingguan)
exports.getStreakAndTarget = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Hitung streak (hari berturut-turut belajar)
    const recentActivities = await prisma.historyPengerjaanPaket.findMany({
      where: { id_subscriber: id_subscriber },
      select: { tanggal: true },
      orderBy: { tanggal: "desc" },
      take: 30,
    });

    let streak = 0;
    let lastDate = null;
    recentActivities.forEach((activity) => {
      if (!activity.tanggal) return;
      const activityDate = new Date(activity.tanggal);
      if (!lastDate) {
        lastDate = activityDate;
        streak = 1;
        return;
      }
      const dayDiff = Math.floor(
        (lastDate - activityDate) / (1000 * 60 * 60 * 24),
      );
      if (dayDiff === 1) {
        streak++;
        lastDate = activityDate;
      }
    });

    // Hitung progress minggu ini (target 10 tes)
    const examsThisWeek = await prisma.paketAttempt.count({
      where: {
        subscribers_id_subscriber: id_subscriber,
        started_at: { gte: weekAgo },
      },
    });

    const weeklyTarget = 10;
    const weeklyProgress = Math.min(examsThisWeek, weeklyTarget);

    res.status(200).json({
      status: "success",
      data: {
        streak: streak || 10,
        weeklyProgress,
        weeklyTarget,
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 9. GET ALL PAKETS WITH PROGRESS (untuk halaman course dengan filter/sort)
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
    let orderBy = { tanggal_dibuat: "desc" }; // default newest

    if (sortBy === "oldest") {
      orderBy = { tanggal_dibuat: "asc" };
    }

    const [pakets, total] = await prisma.$transaction([
      prisma.paketSoal.findMany({
        where: whereClause,
        include: {
          category: true,
          soalPaket: true,
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
        label: paket.nama_paket,
        image: paket.image || "/person.jpg",
        progress: { answered, totalSoal },
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

// 10. GET PAKET DETAIL BY ID
exports.getPaketDetailById = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { id } = req.params;

    const paket = await prisma.paketSoal.findUnique({
      where: { id_paket_soal: parseInt(id) },
      include: {
        category: true,
        creator: { select: { nama_user: true } },
        soalPaket: {
          include: {
            soal: {
              include: {
                topic: { include: { subject: true, jenjang: true } },
              },
            },
          },
        },
        paketAttempt: {
          where: { subscribers_id_subscriber: id_subscriber },
          include: { history: true },
          orderBy: { started_at: "desc" },
          take: 1,
        },
      },
    });

    if (!paket) {
      return res
        .status(404)
        .json({ status: "error", message: "Paket tidak ditemukan" });
    }

    const totalSoal = paket.soalPaket.length;
    const attempt = paket.paketAttempt[0];
    const answered = attempt ? attempt.history.length : 0;

    const formattedData = {
      id: paket.id_paket_soal,
      nama_paket: paket.nama_paket,
      deskripsi: paket.deskripsi,
      image: paket.image,
      category: paket.category?.nama_category || "Umum",
      creator: paket.creator?.nama_user || "Admin",
      jenis: paket.jenis,
      progress: { answered, totalSoal },
      soal_count: totalSoal,
    };

    res.status(200).json({
      status: "success",
      data: formattedData,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
