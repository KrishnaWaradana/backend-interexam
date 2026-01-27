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
          take: 1, // Ambil attempt terbaru
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

    // 1. Total ujian selesai (sepanjang waktu)
    const totalExams = await prisma.paketAttempt.count({
      where: {
        subscribers_id_subscriber: id_subscriber,
        finished_at: { not: null },
      },
    });

    // 2. Ujian selesai minggu ini (untuk tren)
    const examsThisWeek = await prisma.paketAttempt.count({
      where: {
        subscribers_id_subscriber: id_subscriber,
        finished_at: { gte: weekAgo },
      },
    });

    // 3. Rata-rata Skor
    const completedAttempts = await prisma.paketAttempt.findMany({
      where: {
        subscribers_id_subscriber: id_subscriber,
        finished_at: { not: null },
      },
      include: {
        paketSoal: {
          include: { soalPaket: true }, // Untuk tahu total soal
        },
        history: {
          include: {
            jawabanSoal: { select: { status: true } }, // Cek status jawaban benar/salah
          },
        },
      },
      orderBy: { finished_at: "desc" },
      take: 20,
    });

    let avgScore = 0;
    if (completedAttempts.length > 0) {
      const scores = completedAttempts.map((attempt) => {
        const totalQuestions = attempt.paketSoal.soalPaket.length || 1;
        const correctAnswers = attempt.history.filter(
          (h) => h.jawabanSoal?.status === true,
        ).length;

        return (correctAnswers / totalQuestions) * 100;
      });

      // Hitung rata-rata dari array skor
      const totalScore = scores.reduce((a, b) => a + b, 0);
      avgScore = Math.round(totalScore / scores.length);
    }

    // Total waktu belajar
    const totalHistoryItems = await prisma.historyPengerjaanPaket.count({
      where: { id_subscriber: id_subscriber },
    });

    const totalMinutes = totalHistoryItems * 2;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    res.status(200).json({
      status: "success",
      data: {
        // Data Utama
        totalExamsCompleted: totalExams,
        averageScore: avgScore, // Number (misal: 85)
        totalStudyTime: `${hours}j ${minutes}m`,

        comparedToPreviousWeek: {
          exams: Math.max(0, examsThisWeek),
          scoreIncrease: 5,
          studyTimeIncrease: 20,
        },
      },
    });
  } catch (error) {
    console.error("Error statistic:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 8. GET STREAK & WEEKLY TARGET (untuk dashboard - rekor belajar mingguan)
exports.getStreakAndTarget = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // --- 1. Hitung Streak (Hari berturut-turut belajar) ---
    // Ambil tanggal pengerjaan unik berdasarkan hari
    const recentActivities = await prisma.historyPengerjaanPaket.findMany({
      where: { id_subscriber: id_subscriber },
      select: { tanggal: true },
      orderBy: { tanggal: "desc" },
      take: 60, // Ambil cukup banyak untuk cek streak
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

      const sortedDates = Array.from(uniqueDates).sort().reverse(); // Urutkan dari terbaru

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
        id_paket_soal: paket.id_paket_soal,
        label: paket.nama_paket,
        nama_paket: paket.nama_paket,
        image: paket.image || "/person.jpg",
        progress: { answered, totalSoal },
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

// 10. GET PAKET DETAIL BY ID (untuk halaman DetailExam)
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

// Tambahkan di subscriberController.js

exports.saveExamProgress = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { id_paket_soal, answers } = req.body;

    // 1. Cari atau buat PaketAttempt aktif
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

    // 2. Ambil semua relasi soal dan jawaban untuk validasi ID
    const soalRelasi = await prisma.soalPaketSoal.findMany({
      where: { id_paket_soal: parseInt(id_paket_soal) },
      orderBy: { id_soal_paket_soal: "asc" },
      include: { soal: { include: { jawaban: true } } },
    });

    // 3. Bersihkan history lama untuk pengerjaan ini agar fresh
    await prisma.historyPengerjaanPaket.deleteMany({
      where: { id_paket_attempt: attempt.id_paket_attempt },
    });

    // 4. Mapping jawaban ke ID Database yang benar
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

exports.submitExam = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { id_paket_soal, answers } = req.body;

    // 1. Cari atau buat PaketAttempt yang aktif (finished_at = null)
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

    // 2. Ambil relasi soal untuk mapping index frontend ke ID database
    const soalRelasi = await prisma.soalPaketSoal.findMany({
      where: { id_paket_soal: parseInt(id_paket_soal) },
      orderBy: { id_soal_paket_soal: "asc" },
      include: {
        soal: {
          include: { jawaban: true },
        },
      },
    });

    // 3. Bersihkan history lama untuk pengerjaan ini agar data tidak double/duplikat
    await prisma.historyPengerjaanPaket.deleteMany({
      where: { id_paket_attempt: attempt.id_paket_attempt },
    });

    // --- LOGIKA UTAMA YANG KAMU BERIKAN ---
    const historyEntries = [];
    let correctCount = 0;

    for (const [index, userValue] of Object.entries(answers)) {
      const relasi = soalRelasi[parseInt(index)];
      if (relasi) {
        const jawabanDitemukan = relasi.soal.jawaban.find(
          (j) => j.opsi_jawaban_text === userValue,
        );
        if (jawabanDitemukan) {
          // Hitung benar di sini secara sinkron agar akurat
          if (jawabanDitemukan.status === true) correctCount++;

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
    // --------------------------------------

    // 4. Simpan semua history baru secara massal
    if (historyEntries.length > 0) {
      await prisma.historyPengerjaanPaket.createMany({
        data: historyEntries,
      });
    }

    // 5. Kalkulasi skor akhir (Skala 100)
    const totalSoalDalamPaket = soalRelasi.length;
    const finalScore =
      totalSoalDalamPaket > 0
        ? Math.round((correctCount / totalSoalDalamPaket) * 100)
        : 0;

    // 6. Finalisasi: Tandai pengerjaan telah selesai (set finished_at)
    await prisma.paketAttempt.update({
      where: { id_paket_attempt: attempt.id_paket_attempt },
      data: { finished_at: new Date() },
    });

    // 7. Kirim data hasil ke Frontend
    res.status(200).json({
      status: "success",
      message: "Ujian berhasil dikumpulkan",
      data: {
        score: finalScore,
        correct: correctCount,
        wrong: historyEntries.length - correctCount,
        unanswered: totalSoalDalamPaket - historyEntries.length,
        totalSoal: totalSoalDalamPaket,
      },
    });
  } catch (error) {
    console.error("Submit Exam Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};
