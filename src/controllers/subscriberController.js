const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET BANK SOAL UNTUK SUBSCRIBER (untuk halaman Simpan)
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

// GET FAVORIT SOAL (LIST SOAL YANG SUDAH DISIMPAN)
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

// SAVE SOAL KE FAVORITES
exports.saveToFavorites = async (req, res) => {
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
      return res.status(400).json({
        status: "error",
        message: "Soal ini sudah ada di daftar favorit Anda",
      });
    }

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

// HAPUS SOAL DARI FAVORITES
exports.removeFromFavorites = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { id_soal } = req.params;

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

// TOGGLE FAVORITE (SIMPAN/HAPUS)
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

// GET RECENT PAKETS
exports.getRecentPakets = async (req, res) => {
  try {
    const id_subscriber = req.user.id;

    // Ambil paket yang memiliki attempt (baik selesai atau belum)
    const recentPakets = await prisma.paketSoal.findMany({
      where: {
        paketAttempt: {
          some: { subscribers_id_subscriber: id_subscriber },
        },
      },
      include: {
        category: true,
        soalPaket: true,
        paketAttempt: {
          where: { subscribers_id_subscriber: id_subscriber },
          include: { history: true },
          orderBy: { started_at: "desc" },
          take: 1,
        },
      },
      orderBy: { tanggal_dibuat: "desc" },
      take: 4,
    });

    const formattedData = recentPakets.map((paket) => {
      const attempt = paket.paketAttempt[0];
      return {
        id: paket.id_paket_soal,
        label: paket.nama_paket,
        image: paket.image || "/person.jpg",
        progress: {
          answered: attempt ? attempt.history.length : 0,
          totalSoal: paket.soalPaket.length,
          isFinished: attempt?.finished_at !== null,
        },
        category: paket.category?.nama_category || "Umum",
      };
    });

    res.status(200).json({ status: "success", data: formattedData });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 7. GET STATISTICS SUMMARY
exports.getStatisticsSummary = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 hari lalu

    // Total ujian selesai
    const totalExams = await prisma.paketAttempt.count({
      where: {
        subscribers_id_subscriber: id_subscriber,
        finished_at: { not: null },
      },
    });

    // Ujian selesai minggu ini (untuk perbandingan tren)
    const examsThisWeek = await prisma.paketAttempt.count({
      where: {
        subscribers_id_subscriber: id_subscriber,
        finished_at: { gte: weekAgo },
      },
    });

    // --- HITUNG XP & LEVEL (GAMIFICATION) ---
    const xpResult = await prisma.historyPengerjaanPaket.aggregate({
      _sum: {
        skor_point: true,
      },
      where: {
        id_subscriber: id_subscriber,
      },
    });

    // Total XP User saat ini (Jika null set 0)
    const currentXP = xpResult._sum.skor_point || 0;

    // Konfigurasi Level
    const XP_PER_LEVEL = 500;

    // Hitung Level: (XP / 500) dibulatkan ke bawah, ditambah 1.
    // Contoh: 0-499 XP = Level 1. 500-999 XP = Level 2.
    const currentLevel = Math.floor(currentXP / XP_PER_LEVEL) + 1;

    // Hitung Progress Bar di level saat ini
    const startXPThisLevel = (currentLevel - 1) * XP_PER_LEVEL;
    const xpProgress = currentXP - startXPThisLevel;
    const percentage = Math.min(
      100,
      Math.round((xpProgress / XP_PER_LEVEL) * 100),
    );

    // Tentukan Label Pangkat berdasarkan Level
    let levelLabel = "Pemula";
    if (currentLevel >= 5) levelLabel = "Pejuang";
    if (currentLevel >= 10) levelLabel = "Sepuh";
    if (currentLevel >= 20) levelLabel = "Master";
    if (currentLevel >= 50) levelLabel = "Legenda";

    const totalHistoryItems = await prisma.historyPengerjaanPaket.count({
      where: { id_subscriber: id_subscriber },
    });

    const totalMinutes = totalHistoryItems * 2;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const completedAttempts = await prisma.paketAttempt.findMany({
      where: {
        subscribers_id_subscriber: id_subscriber,
        finished_at: { not: null },
      },
      include: {
        paketSoal: { include: { soalPaket: true } },
        history: {
          include: { jawabanSoal: { select: { status: true } } },
        },
      },
      orderBy: { finished_at: "desc" },
      take: 20,
    });

    let avgScore = 0;
    if (completedAttempts.length > 0) {
      const scores = completedAttempts.map((attempt) => {
        const totalQuestions = attempt.paketSoal.soalPaket.length || 1;
        // Hitung jumlah benar manual dari history
        const correctAnswers = attempt.history.filter(
          (h) => h.jawabanSoal?.status === true,
        ).length;

        return (correctAnswers / totalQuestions) * 100;
      });

      const totalScoreSum = scores.reduce((a, b) => a + b, 0);
      avgScore = Math.round(totalScoreSum / scores.length);
    }

    // --- RESPONSE  ---
    res.status(200).json({
      status: "success",
      data: {
        totalExamsCompleted: totalExams,

        // Data Waktu Belajar
        studyTime: {
          hours,
          minutes,
          fullText: `${hours} jam ${minutes} menit`,
        },

        // Data Level & XP
        experience: {
          level: currentLevel,
          label: levelLabel,
          currentXP: xpProgress,
          maxXP: XP_PER_LEVEL,
          totalXP: currentXP,
          percentage: percentage,
        },

        // Data Skor (Card Oranye)
        averageScore: avgScore,

        // Data Tren
        comparedToPreviousWeek: {
          exams: Math.max(0, examsThisWeek),
        },
      },
    });
  } catch (error) {
    console.error("Error statistic:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// GET STREAK & WEEKLY TARGET (untuk dashboard - rekor belajar mingguan)
exports.getStreakAndTarget = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // --- Hitung Streak (Hari berturut-turut belajar) ---
    const recentActivities = await prisma.historyPengerjaanPaket.findMany({
      where: { id_subscriber: id_subscriber },
      select: { tanggal: true },
      orderBy: { tanggal: "desc" },
      take: 60,
    });

    let streak = 0;

    if (recentActivities.length > 0) {
      // Set untuk menyimpan tanggal unik (YYYY-MM-DD) agar pengerjaan multiple di hari sama dihitung 1
      const uniqueDates = new Set();
      recentActivities.forEach((act) => {
        if (act.tanggal) {
          uniqueDates.add(new Date(act.tanggal).toISOString().split("T")[0]);
        }
      });

      const sortedDates = Array.from(uniqueDates).sort().reverse();

      const todayStr = now.toISOString().split("T")[0];
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      // Cek apakah streak masih aktif (belajar hari ini atau kemarin)
      if (sortedDates[0] === todayStr || sortedDates[0] === yesterdayStr) {
        let currentDate = new Date(sortedDates[0]);
        streak = 1;

        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = new Date(sortedDates[i]);
          const diffTime = Math.abs(currentDate - prevDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            streak++;
            currentDate = prevDate;
          } else {
            break;
          }
        }
      }
    }

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
        streak: streak,
        weeklyProgress: weeklyProgress,
        weeklyTarget: weeklyTarget,
        message:
          streak > 0 ? "Streak terjaga! 🔥" : "Ayo mulai belajar hari ini!",
      },
    });
  } catch (error) {
    console.error("Error streak:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// GET ALL PAKETS WITH PROGRESS (untuk halaman course dengan filter/sort)
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

// GET PAKET DETAIL BY ID
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
                jawaban: {
                  orderBy: { id_jawaban: "asc" },
                },
              },
            },
          },
          orderBy: { id_soal_paket_soal: "asc" },
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

    // Helper untuk mendapatkan jawaban benar
    const getCorrectAnswer = (jawaban) => {
      const correctAnswerObj = jawaban.find((j) => j.status === true);
      if (!correctAnswerObj) return "a";
      const index = jawaban.indexOf(correctAnswerObj);
      return String.fromCharCode(97 + index);
    };

    const formattedData = {
      id_paket_soal: paket.id_paket_soal,
      label: paket.nama_paket,
      nama_paket: paket.nama_paket,
      deskripsi: paket.deskripsi,
      image: paket.image,
      category: paket.category?.nama_category || "Umum",
      creator: paket.creator?.nama_user || "Admin",
      jenis: paket.jenis,
      soal_count: totalSoal,
      progress: { answered, totalSoal },
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

    res.status(200).json({
      status: "success",
      data: formattedData,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Save Exam Progress
exports.saveExamProgress = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { id_paket_soal, answers } = req.body;

    // Cari atau buat PaketAttempt aktif
    let attempt = await prisma.paketAttempt.findFirst({
      where: {
        paket_soal_id_paket_soal: parseInt(id_paket_soal),
        subscribers_id_subscriber: id_subscriber,
        finished_at: null,
      },
    });

    if (!attempt) {
      attempt = await prisma.paketAttempt.create({
        data: {
          paket_soal_id_paket_soal: parseInt(id_paket_soal),
          subscribers_id_subscriber: id_subscriber,
          started_at: new Date(),
        },
      });
    }

    // Ambil semua relasi soal dan jawaban untuk validasi ID
    const soalRelasi = await prisma.soalPaketSoal.findMany({
      where: { id_paket_soal: parseInt(id_paket_soal) },
      orderBy: { id_soal_paket_soal: "asc" },
      include: { soal: { include: { jawaban: true } } },
    });

    // Bersihkan history lama untuk pengerjaan ini agar fresh
    await prisma.historyPengerjaanPaket.deleteMany({
      where: { id_paket_attempt: attempt.id_paket_attempt },
    });

    // Mapping jawaban ke ID Database yang benar
    const historyEntries = [];
    for (const [index, userValue] of Object.entries(answers)) {
      const relasi = soalRelasi[parseInt(index)];
      if (relasi) {
        // Cari ID jawaban berdasarkan teks yang diklik user
        const jawabanDitemukan = relasi.soal.jawaban.find(
          (j) => j.opsi_jawaban_text === userValue,
        );

        if (jawabanDitemukan) {
          historyEntries.push({
            id_subscriber,
            id_paket_attempt: attempt.id_paket_attempt,
            id_soal_paket_soal: relasi.id_soal_paket_soal,
            id_jawaban: jawabanDitemukan.id_jawaban,
            short_answer: String(userValue),
            tanggal: new Date(),
          });
        }
      }
    }

    if (historyEntries.length > 0) {
      await prisma.historyPengerjaanPaket.createMany({ data: historyEntries });
    }

    res
      .status(200)
      .json({ status: "success", message: "Progres berhasil disinkronkan" });
  } catch (error) {
    console.error("Save Progress Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Sumbit Exam
exports.submitExam = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { id_paket_soal, answers } = req.body;

    let attempt = await prisma.paketAttempt.findFirst({
      where: {
        paket_soal_id_paket_soal: parseInt(id_paket_soal),
        subscribers_id_subscriber: id_subscriber,
        finished_at: null,
      },
    });

    if (!attempt) {
      attempt = await prisma.paketAttempt.create({
        data: {
          paket_soal_id_paket_soal: parseInt(id_paket_soal),
          subscribers_id_subscriber: id_subscriber,
          started_at: new Date(),
        },
      });
    }

    const soalRelasi = await prisma.soalPaketSoal.findMany({
      where: { id_paket_soal: parseInt(id_paket_soal) },
      orderBy: { id_soal_paket_soal: "asc" },
      include: {
        soal: {
          include: { jawaban: true },
        },
      },
    });

    await prisma.historyPengerjaanPaket.deleteMany({
      where: { id_paket_attempt: attempt.id_paket_attempt },
    });

    const historyEntries = [];
    let correctCount = 0;
    const POIN_PER_SOAL = 10;

    for (const [index, userValue] of Object.entries(answers)) {
      const relasi = soalRelasi[parseInt(index)];

      if (relasi) {
        const jawabanDitemukan = relasi.soal.jawaban.find(
          (j) => j.opsi_jawaban_text === userValue,
        );

        if (jawabanDitemukan) {
          const isCorrect = jawabanDitemukan.status === true;

          const earnedPoint = isCorrect ? POIN_PER_SOAL : 0;

          if (isCorrect) correctCount++;

          historyEntries.push({
            id_subscriber,
            id_paket_attempt: attempt.id_paket_attempt,
            id_soal_paket_soal: relasi.id_soal_paket_soal,
            id_jawaban: jawabanDitemukan.id_jawaban,
            short_answer: String(userValue),
            tanggal: new Date(),
            skor_point: parseFloat(earnedPoint),
          });
        }
      }
    }

    if (historyEntries.length > 0) {
      await prisma.historyPengerjaanPaket.createMany({
        data: historyEntries,
      });
    }

    const totalSoal = soalRelasi.length;

    const finalScore =
      totalSoal > 0 ? Math.round((correctCount / totalSoal) * 100) : 0;

    await prisma.paketAttempt.update({
      where: { id_paket_attempt: attempt.id_paket_attempt },
      data: { finished_at: new Date() },
    });

    res.status(200).json({
      status: "success",
      message: "Ujian berhasil dikumpulkan",
      data: {
        score: finalScore,
        correct: correctCount,
        wrong: historyEntries.length - correctCount,
        unanswered: totalSoal - historyEntries.length,
        totalSoal: totalSoal,
      },
    });
  } catch (error) {
    console.error("Submit Exam Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// GET LEADERBOARD PER PAKET
exports.getExamLeaderboard = async (req, res) => {
  try {
    const { id } = req.params;

    // Ambil semua attempt yang sudah selesai untuk paket ini
    const attempts = await prisma.paketAttempt.findMany({
      where: {
        paket_soal_id_paket_soal: parseInt(id),
        finished_at: { not: null },
      },
      include: {
        subscriber: {
          select: {
            nama_subscriber: true,
            foto: true,
          },
        },
        history: true,
        paketSoal: {
          include: { soalPaket: true },
        },
      },
    });

    // Format dan Hitung Skor Manual (karena skor tersimpan di history per soal)
    const leaderboard = attempts.map((attempt) => {
      // Hitung total skor dari kolom skor_point di history
      const totalScore = attempt.history.reduce((acc, curr) => {
        return acc + (curr.skor_point || 0);
      }, 0);

      const correctCount = attempt.history.filter(
        (h) => (h.skor_point || 0) > 0,
      ).length;

      const totalSoal = attempt.paketSoal.soalPaket.length;

      return {
        id: attempt.subscribers_id_subscriber,
        name: attempt.subscriber.nama_subscriber || "User",
        avatar: attempt.subscriber.foto || null,
        correct: correctCount,
        total: totalSoal,
        score: Math.round(totalScore),
        finished_at: attempt.finished_at,
      };
    });

    leaderboard.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return new Date(a.finished_at) - new Date(b.finished_at);
    });

    const topTen = leaderboard.slice(0, 10);

    res.status(200).json({
      status: "success",
      data: topTen,
    });
  } catch (error) {
    console.error("Leaderboard Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 14. GET PROGRESS ANALYTICS (Hari Ini & Mingguan)
exports.getProgressAnalytics = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { period = "weekly" } = req.query; // Menerima parameter 'today' atau 'weekly'

    const now = new Date();
    let startDate, endDate, prevStartDate, prevEndDate;
    let chartLabels = [];
    let chartData = [];

    // --- A. TENTUKAN RENTANG WAKTU ---
    if (period === "today") {
      // --- PERIODE: HARI INI ---
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0); // Jam 00:00 hari ini

      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999); // Jam 23:59 hari ini

      // PEMBANDING: KEMARIN
      prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - 1);

      prevEndDate = new Date(endDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);

      // Label Chart untuk Hari Ini (Interval 4 jam)
      chartLabels = ["00-04", "04-08", "08-12", "12-16", "16-20", "20-24"];

      // Inisialisasi data chart (6 segmen)
      chartData = [0, 0, 0, 0, 0, 0];
    } else {
      // --- PERIODE: MINGGUAN (Senin - Minggu) ---
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust ke Senin

      startDate = new Date(now);
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(); // Sampai detik ini
      endDate.setHours(23, 59, 59, 999);

      // PEMBANDING: MINGGU LALU
      prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - 7);

      prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      prevEndDate.setHours(23, 59, 59, 999);

      chartLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Ming"];

      // Inisialisasi data chart (7 hari)
      chartData = [0, 0, 0, 0, 0, 0, 0];
    }

    // --- B. DATA UJIAN (Card 1) ---
    const examsCurrent = await prisma.paketAttempt.count({
      where: {
        subscribers_id_subscriber: id_subscriber,
        finished_at: { gte: startDate, lte: endDate },
      },
    });

    const examsPrev = await prisma.paketAttempt.count({
      where: {
        subscribers_id_subscriber: id_subscriber,
        finished_at: { gte: prevStartDate, lte: prevEndDate },
      },
    });

    // --- C. DATA WAKTU BELAJAR (Card 3) ---
    // Hitung berdasarkan history soal yang dikerjakan
    const historyCurrent = await prisma.historyPengerjaanPaket.count({
      where: {
        id_subscriber: id_subscriber,
        tanggal: { gte: startDate, lte: endDate },
      },
    });

    const historyPrev = await prisma.historyPengerjaanPaket.count({
      where: {
        id_subscriber: id_subscriber,
        tanggal: { gte: prevStartDate, lte: prevEndDate },
      },
    });

    const timeCurrentMinutes = historyCurrent * 2; // Asumsi 1 soal = 2 menit
    const timePrevMinutes = historyPrev * 2;

    // --- D. DATA RATA-RATA SKOR (Card 2) ---
    const calculateAvgScore = async (start, end) => {
      const attempts = await prisma.paketAttempt.findMany({
        where: {
          subscribers_id_subscriber: id_subscriber,
          finished_at: { gte: start, lte: end },
        },
        include: {
          history: { select: { skor_point: true } },
          paketSoal: { include: { soalPaket: true } },
        },
      });

      if (attempts.length === 0) return 0;

      let totalPercentage = 0;
      attempts.forEach((att) => {
        // Hitung skor total paket (jika point tidak ada, default 10 per soal)
        const maxScore = att.paketSoal.soalPaket.length * 10;
        const userScore = att.history.reduce(
          (acc, curr) => acc + (curr.skor_point || 0),
          0,
        );

        // Prevent division by zero
        const percentage = maxScore > 0 ? (userScore / maxScore) * 100 : 0;
        totalPercentage += percentage;
      });

      return Math.round(totalPercentage / attempts.length);
    };

    const scoreCurrent = await calculateAvgScore(startDate, endDate);
    const scorePrev = await calculateAvgScore(prevStartDate, prevEndDate);

    // --- E. GRAFIK BATANG (Chart Data Processing) ---
    // Ambil data history mentah untuk di-mapping ke chart
    const rawHistory = await prisma.historyPengerjaanPaket.findMany({
      where: {
        id_subscriber,
        tanggal: { gte: startDate, lte: endDate },
      },
      select: { tanggal: true },
    });

    if (period === "today") {
      // Mapping per 4 jam
      rawHistory.forEach((act) => {
        const hour = new Date(act.tanggal).getHours();
        if (hour < 4)
          chartData[0] += 2; // 00-04
        else if (hour < 8)
          chartData[1] += 2; // 04-08
        else if (hour < 12)
          chartData[2] += 2; // 08-12
        else if (hour < 16)
          chartData[3] += 2; // 12-16
        else if (hour < 20)
          chartData[4] += 2; // 16-20
        else chartData[5] += 2; // 20-24
      });
    } else {
      // Mapping per Hari (Senin=0, Minggu=6)
      rawHistory.forEach((act) => {
        const date = new Date(act.tanggal);
        const day = date.getDay(); // 0=Minggu, 1=Senin
        // Ubah ke format: Senin=0 ... Minggu=6
        const index = (day + 6) % 7;
        chartData[index] += 2; // Tambah 2 menit
      });
    }

    // --- F. RESPONSE ---
    res.status(200).json({
      status: "success",
      data: {
        period: period,
        // Card 1: Ujian
        exams: {
          current: examsCurrent,
          diff: examsCurrent - examsPrev,
          label: period === "today" ? "Ujian Hari Ini" : "Ujian Minggu Ini",
        },
        // Card 2: Skor
        score: {
          current: scoreCurrent,
          diff: scoreCurrent - scorePrev,
        },
        // Card 3: Waktu (Formatted)
        studyTime: {
          current: timeCurrentMinutes,
          diff: timeCurrentMinutes - timePrevMinutes,
          formatted:
            timeCurrentMinutes >= 60
              ? `${Math.floor(timeCurrentMinutes / 60)}j ${timeCurrentMinutes % 60}m`
              : `${timeCurrentMinutes}m`,
        },
        // Chart
        chart: {
          labels: chartLabels,
          data: chartData,
          unit: "menit",
        },
        // Sidebar Logs (Ringkasan Otomatis)
        logs: [
          {
            type: "sistem",
            text:
              scoreCurrent > scorePrev
                ? `Skor rata-rata kamu naik ${scoreCurrent - scorePrev}% dibanding periode lalu.`
                : `Skor rata-rata kamu turun ${scorePrev - scoreCurrent}% dibanding periode lalu.`,
          },
          {
            type: "sistem",
            text: `Total waktu belajar aktif: ${Math.floor(timeCurrentMinutes / 60)} jam ${timeCurrentMinutes % 60} menit.`,
          },
        ],
      },
    });
  } catch (error) {
    console.error("Progress Analytics Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};
