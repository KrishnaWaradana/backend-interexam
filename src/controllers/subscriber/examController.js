const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Get Paket Detail By Id
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

// Submit Exam
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

// Get Exam Leaderboard
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