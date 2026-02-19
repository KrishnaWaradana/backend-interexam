const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Get Paket Detail By Id
exports.getPaketDetailById = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { id } = req.params;

    // 1. AMBIL DATA PAKET (Termasuk Soal & Jawaban)
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
                // PENTING: Ambil relasi jawaban untuk opsi pilihan ganda
                jawaban: {
                  orderBy: { id_jawaban: "asc" },
                },
              },
            },
          },
          orderBy: { id_soal_paket_soal: "asc" },
        },
        // Ambil progress user untuk paket ini (jika ada)
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

    // 2. CEK STATUS LANGGANAN (STRATEGI NO 2)
    const subscriber = await prisma.subscribers.findUnique({
      where: { id_subscriber: id_subscriber },
      select: { status_langganan: true }, // Pastikan field ini ada di tabel subscribers/subscribePaket
    });

    // NOTE: Sesuaikan logika status ini dengan schema database-mu
    // Misal: Cek tabel 'SubscribePaket' jika status langganan terpisah
    const activeSub = await prisma.subscribePaket.findFirst({
      where: {
        id_subscriber: id_subscriber,
        status: "active",
        tanggal_selesai: { gte: new Date() },
      },
    });

    const isUserPremium = !!activeSub; // User dianggap premium jika punya langganan aktif

    // Normalisasi jenis paket (antisipasi case sensitivity)
    const jenisPaket = paket.jenis?.toLowerCase()?.trim() || "gratis";
    const isPaketPremium =
      jenisPaket === "berbayar" || jenisPaket === "premium";

    // Kunci konten JIKA: Paket Berbayar DAN User Tidak Premium
    const shouldHideSoal = isPaketPremium && !isUserPremium;

    // 3. SIAPKAN DATA UMUM
    const totalSoal = paket.soalPaket.length;
    const attempt = paket.paketAttempt[0];
    const answered = attempt ? attempt.history.length : 0;

    // 4. MAPPING DATA (FORMATTING)
    const formattedData = {
      id_paket_soal: paket.id_paket_soal,
      label: paket.nama_paket,
      nama_paket: paket.nama_paket,
      deskripsi: paket.deskripsi,
      image: paket.image,
      category: paket.category?.nama_category || "Umum",
      creator: paket.creator?.nama_user || "Admin",
      jenis: paket.jenis, // Dikirim agar FE bisa menampilkan badge gembok

      // Metadata Soal
      soal_count: totalSoal,
      progress: { answered, totalSoal },

      // --- LOGIKA UTAMA: MAP SOAL & OPSI JAWABAN ---
      soal_paket_soal: shouldHideSoal
        ? [] // KOSONGKAN ARRAY JIKA TERKUNCI (SECURITY)
        : paket.soalPaket.map((sp) => {
            const s = sp.soal;

            // Logika Opsi Berdasarkan Jenis Soal
            let formattedOptions = [];

            if (s.jenis_soal === "short_answer") {
              // Short Answer: Tidak butuh opsi (user mengetik)
              formattedOptions = [];
            } else {
              // Multiple Choice, Multiple Answer, True False:
              // Map dari tabel 'JawabanSoal' ke format yang dimengerti FE
              formattedOptions = s.jawaban.map((j) => ({
                id: j.id_jawaban,
                text: j.opsi_jawaban_text,
                image: j.path_gambar_jawaban,
                // KEAMANAN: Jangan kirim status 'benar/salah' ke Frontend!
              }));
            }

            return {
              id_soal_paket_soal: sp.id_soal_paket_soal,
              id_soal: s.id_soal,
              id_paket_soal: sp.id_paket_soal,
              point: sp.point,
              durasi: sp.durasi,
              soal: {
                id_soal: s.id_soal,
                text_soal: s.text_soal,

                // Kirim Jenis Soal agar FE tahu harus render Radio/Checkbox/Textarea
                jenis_soal: s.jenis_soal,

                level_kesulitan: s.level_kesulitan,

                // Kirim Opsi yang sudah diformat
                options: formattedOptions,

                topic: s.topic?.nama_topics,
                subject: s.topic?.subject?.nama_subject,
                jenjang: s.topic?.jenjang?.nama_jenjang,

                // Deskripsi/Pembahasan biasanya dikirim NANTI setelah submit (tergantung logic bisnis kamu)
                // deskripsi: s.jawaban[0]?.pembahasan || "",
              },
            };
          }),
    };

    res.status(200).json({
      status: "success",
      data: formattedData,
      is_locked: shouldHideSoal, // Flag tambahan untuk memudahkan FE
    });
  } catch (error) {
    console.error("Error Detail Paket:", error);
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
