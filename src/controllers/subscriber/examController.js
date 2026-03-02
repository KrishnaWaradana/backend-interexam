const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ============================================================
// HELPER FUNCTIONS untuk handle Multiple Answer Questions
// ============================================================

/**
 * Normalize user answer input ke dalam bentuk array
 * @param {string|array} userValue - Input dari user (bisa string atau array)
 * @returns {array} Array of answer values
 */
function normalizeAnswers(userValue) {
  if (Array.isArray(userValue)) {
    return userValue;
  }
  if (userValue && typeof userValue === "string") {
    return [userValue];
  }
  return [];
}

/**
 * Process jawaban user untuk satu soal
 * Handle both single dan multiple answer questions
 * @param {object} relasi - soal relation object dari DB
 * @param {string|array} userValue - answer(s) dari user
 * @param {int} id_paket_attempt - paket attempt ID
 * @param {int} id_subscriber - subscriber ID
 * @returns {object} { historyEntries: [], isCorrect: boolean, answerCount: int }
 */
function processAnswersForSoal(
  relasi,
  userValue,
  id_paket_attempt,
  id_subscriber,
) {
  const normalizedAnswers = normalizeAnswers(userValue);
  const historyEntries = [];
  let isCorrect = false; // ← Default false, bukan true!
  let answerCount = 0;

  // Untuk jawaban kosong
  if (!normalizedAnswers.length) {
    return { historyEntries, isCorrect: false, answerCount: 0 };
  }

  // Dapatkan correct answers dari soal
  const correctAnswerIds = relasi.soal.jawaban
    .filter((j) => j.status === true)
    .map((j) => j.id_jawaban);

  // Proses setiap jawaban yang dipilih user
  const processedAnswerIds = new Set();

  for (const answerText of normalizedAnswers) {
    const jawabanDitemukan = relasi.soal.jawaban.find(
      (j) => j.opsi_jawaban_text === answerText,
    );

    if (jawabanDitemukan) {
      // Avoid duplicate if user somehow picks same answer twice
      if (!processedAnswerIds.has(jawabanDitemukan.id_jawaban)) {
        processedAnswerIds.add(jawabanDitemukan.id_jawaban);

        historyEntries.push({
          id_subscriber,
          id_paket_attempt,
          id_soal_paket_soal: relasi.id_soal_paket_soal,
          id_jawaban: jawabanDitemukan.id_jawaban,
          short_answer: String(answerText),
          tanggal: new Date(),
        });
      }
    }
  }

  answerCount = processedAnswerIds.size;

  // VALIDASI JAWABAN BERDASARKAN JENIS SOAL
  if (relasi.soal.jenis_soal === "multiple_answer") {
    // Multiple Answer: User HARUS pilih PERSIS jawaban yang benar
    // Semua yang dipilih harus benar DAN jumlahnya pas
    if (
      answerCount === correctAnswerIds.length &&
      Array.from(processedAnswerIds).every((id) =>
        correctAnswerIds.includes(id),
      )
    ) {
      isCorrect = true;
    } else {
      isCorrect = false;
    }
  } else {
    // Single Answer (multiple_choice, true_false, short_answer):
    // Cukup 1 jawaban benar
    if (answerCount > 0) {
      isCorrect = Array.from(processedAnswerIds).some((id) =>
        correctAnswerIds.includes(id),
      );
    } else {
      isCorrect = false;
    }
  }

  return { historyEntries, isCorrect, answerCount };
}

// Get Paket Detail By Id
exports.getPaketDetailById = async (req, res) => {
  try {
    const id_subscriber = parseInt(req.user.id);
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

    // 2. CEK STATUS LANGGANAN (PERBAIKAN BERDASARKAN SCHEMA)
    // Cek di tabel SubscribePaket apakah user punya langganan yang masih aktif
    const activeSub = await prisma.subscribePaket.findFirst({
      where: {
        id_subscriber: id_subscriber,
        status: "active",
        tanggal_selesai: { gte: new Date() },
      },
    });

    // User dianggap premium jika punya setidaknya satu langganan aktif
    const isUserPremium = !!activeSub;

    // Cek tipe paket (Berdasarkan Enum JenisPaket: "gratis" atau "berbayar")
    const isPaketPremium = paket.jenis === "berbayar";

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

                // Deskripsi/Pembahasan disembunyikan di mode pengerjaan
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
    const { id_paket_soal, answers, id_event } = req.body;

    // Cari atau buat PaketAttempt aktif
    let attempt = await prisma.paketAttempt.findFirst({
      where: {
        paket_soal_id_paket_soal: parseInt(id_paket_soal),
        subscribers_id_subscriber: id_subscriber,
        id_event: id_event ? parseInt(id_event) : null,
        finished_at: null,
      },
    });

    if (!attempt) {
      attempt = await prisma.paketAttempt.create({
        data: {
          paket_soal_id_paket_soal: parseInt(id_paket_soal),
          subscribers_id_subscriber: id_subscriber,
          id_event: id_event ? parseInt(id_event) : null,
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
        // Process answers (handle both single dan multiple)
        const { historyEntries: entries } = processAnswersForSoal(
          relasi,
          userValue,
          attempt.id_paket_attempt,
          id_subscriber,
        );

        historyEntries.push(...entries);
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
    const { id_paket_soal, answers, id_event } = req.body;

    let attempt = await prisma.paketAttempt.findFirst({
      where: {
        paket_soal_id_paket_soal: parseInt(id_paket_soal),
        subscribers_id_subscriber: id_subscriber,
        id_event: id_event ? parseInt(id_event) : null,
        finished_at: null,
      },
    });

    if (!attempt) {
      attempt = await prisma.paketAttempt.create({
        data: {
          paket_soal_id_paket_soal: parseInt(id_paket_soal),
          subscribers_id_subscriber: id_subscriber,
          id_event: id_event ? parseInt(id_event) : null,
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
        // Process answers (handle both single dan multiple)
        const {
          historyEntries: entries,
          isCorrect,
          answerCount,
        } = processAnswersForSoal(
          relasi,
          userValue,
          attempt.id_paket_attempt,
          id_subscriber,
        );

        // Add skor_point to each entry
        const entriesWithScore = entries.map((entry) => ({
          ...entry,
          skor_point: isCorrect ? POIN_PER_SOAL : 0,
        }));

        historyEntries.push(...entriesWithScore);

        // Count as correct if user answered correctly
        if (isCorrect && answerCount > 0) {
          correctCount++;
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
        wrong: totalSoal - correctCount,
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

    // 1. Ambil semua attempt yang sudah selesai
    const attempts = await prisma.paketAttempt.findMany({
      where: {
        paket_soal_id_paket_soal: parseInt(id),
        finished_at: { not: null },
      },
      orderBy: {
        started_at: "asc",
      },
      include: {
        subscriber: {
          select: { nama_subscriber: true, foto: true },
        },
        history: true,
        paketSoal: {
          include: { soalPaket: true },
        },
      },
    });

    // 2. DEDUPLIKASI (Hanya ambil percobaan PERTAMA tiap user)
    const uniqueAttemptsMap = new Map();
    attempts.forEach((attempt) => {
      const userId = attempt.subscribers_id_subscriber;
      if (!uniqueAttemptsMap.has(userId)) {
        uniqueAttemptsMap.set(userId, attempt);
      }
    });
    const uniqueAttempts = Array.from(uniqueAttemptsMap.values());

    // 3. Format, Hitung Skor, dan Hitung DURASI INTERNAL
    const leaderboard = uniqueAttempts.map((attempt) => {
      const totalScore = attempt.history.reduce((acc, curr) => {
        return acc + (curr.skor_point || 0);
      }, 0);

      const correctCount = attempt.history.filter(
        (h) => (h.skor_point || 0) > 0,
      ).length;

      const totalSoal = attempt.paketSoal.soalPaket.length;

      // Hitung selisih waktu dalam milidetik (Stopwatch Internal)
      const waktuMulai = new Date(attempt.started_at).getTime();
      const waktuSelesai = new Date(attempt.finished_at).getTime();
      const durasiSistem = waktuSelesai - waktuMulai;

      return {
        id: attempt.subscribers_id_subscriber,
        name: attempt.subscriber.nama_subscriber || "User",
        avatar: attempt.subscriber.foto || null,
        correct: correctCount,
        total: totalSoal,
        score: Math.round(totalScore),
        _durasiRahasia: durasiSistem, // Properti sementara untuk sorting
      };
    });

    // 4. SORTING: Skor Tertinggi -> Durasi Tercepat
    leaderboard.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score; // Skor DESC
      }
      return a._durasiRahasia - b._durasiRahasia; // Durasi ASC (Makin kecil makin cepat)
    });

    // 5. AMBIL TOP 10 & BERSIHKAN DATA DURASI SEBELUM DIKIRIM KE FE
    const topTenClean = leaderboard.slice(0, 10).map((user) => {
      // Kita pecah (destructure) object user untuk membuang _durasiRahasia
      const { _durasiRahasia, ...dataBersih } = user;
      return dataBersih;
    });

    res.status(200).json({
      status: "success",
      data: topTenClean,
    });
  } catch (error) {
    console.error("Leaderboard Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

exports.getDiscussion = async (req, res) => {
  try {
    const id_subscriber = req.user.id;
    const { id_paket_soal } = req.params;
    const { id_event } = req.query; // Opsional jika nanti mau dipakai untuk event

    // 1. Cari riwayat pengerjaan TERAKHIR yang sudah selesai
    const attempt = await prisma.paketAttempt.findFirst({
      where: {
        subscribers_id_subscriber: id_subscriber,
        paket_soal_id_paket_soal: parseInt(id_paket_soal),
        id_event: id_event ? parseInt(id_event) : null,
        finished_at: { not: null }, // Pastikan sudah disubmit
      },
      orderBy: { finished_at: "desc" },
      include: {
        paketSoal: true,
        history: true, // Ambil jawaban user
      },
    });

    if (!attempt) {
      return res.status(404).json({
        status: "error",
        message: "Hasil pengerjaan tidak ditemukan atau belum selesai.",
      });
    }

    // 2. Ambil seluruh Master Soal dari Paket tersebut
    const soalRelasi = await prisma.soalPaketSoal.findMany({
      where: { id_paket_soal: parseInt(id_paket_soal) },
      orderBy: { id_soal_paket_soal: "asc" },
      include: {
        soal: {
          include: {
            attachments: true,
            jawaban: true, // Ambil semua opsi dan pembahasannya
          },
        },
      },
    });

    // 3. Gabungkan Data Master Soal dengan Jawaban User
    const pembahasanData = soalRelasi.map((item, index) => {
      // Ambil SEMUA history entries untuk soal ini (bisa multiple untuk soal multiple_answer)
      const historyItems = attempt.history.filter(
        (h) => h.id_soal_paket_soal === item.id_soal_paket_soal,
      );

      // Cari kunci jawaban yang benar dari sistem
      const correctAnswers = item.soal.jawaban.filter((j) => j.status === true);

      // Cari jawaban yang dipilih user (bisa multiple)
      const userPickedAnswers = historyItems
        .map((h) =>
          item.soal.jawaban.find((j) => j.id_jawaban === h.id_jawaban),
        )
        .filter((j) => j); // Filter out undefined

      // Tentukan status
      const isSkipped = historyItems.length === 0;
      let isCorrect = false;

      if (!isSkipped) {
        // Untuk soal multiple_answer: user harus pilih PERSIS jawaban yang benar
        if (item.soal.jenis_soal === "multiple_answer") {
          if (
            userPickedAnswers.length === correctAnswers.length &&
            userPickedAnswers.every((j) => j.status === true)
          ) {
            isCorrect = true;
          }
        } else {
          // Untuk single answer: cukup satu yang benar
          isCorrect = userPickedAnswers.some((j) => j.status === true);
        }
      }

      let statusJawaban = "dilewati";
      if (!isSkipped) {
        statusJawaban = isCorrect ? "benar" : "salah";
      }

      return {
        no_soal: index + 1,
        id_soal: item.soal.id_soal,
        text_soal: item.soal.text_soal,
        jenis_soal: item.soal.jenis_soal,
        attachments: item.soal.attachments,
        status_jawaban: statusJawaban,

        // Kirim semua opsi jawaban (untuk UI pilihan ganda)
        opsi_jawaban: item.soal.jawaban.map((j) => ({
          id_jawaban: j.id_jawaban,
          teks: j.opsi_jawaban_text,
          is_correct: j.status === true,
        })),

        // Detail Jawaban User - HANDLE MULTIPLE ANSWERS
        jawaban_user:
          userPickedAnswers.length > 0
            ? userPickedAnswers.map((j) => ({
                id_jawaban: j.id_jawaban,
                teks: j.opsi_jawaban_text,
              }))
            : null,

        // Kunci Jawaban & Pembahasan (Untuk multiple_answer, bisa multiple)
        kunci_jawaban:
          correctAnswers.length > 0
            ? correctAnswers.map((j) => j.opsi_jawaban_text).join(", ")
            : null,
        pembahasan:
          correctAnswers[0]?.pembahasan ||
          "Tidak ada pembahasan untuk soal ini.",
      };
    });

    // 4. Hitung ringkasan statistik (Opsional untuk header di Frontend)
    const summary = {
      total_soal: soalRelasi.length,
      benar: pembahasanData.filter((d) => d.status_jawaban === "benar").length,
      salah: pembahasanData.filter((d) => d.status_jawaban === "salah").length,
      dilewati: pembahasanData.filter((d) => d.status_jawaban === "dilewati")
        .length,
    };

    res.status(200).json({
      status: "success",
      message: "Data pembahasan berhasil dimuat",
      data: {
        paket: attempt.paketSoal.nama_paket,
        tanggal_pengerjaan: attempt.finished_at,
        summary: summary,
        pembahasan: pembahasanData,
      },
    });
  } catch (error) {
    console.error("Get Discussion Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

exports.getEventPaketDetail = async (req, res) => {
  try {
    const id_subscriber = parseInt(req.user.id);
    const id_event = parseInt(req.params.id_event); // Ambil dari URL: /events/:id_event/...
    const id_paket_soal = parseInt(req.params.id_paket_soal); // Ambil dari URL: .../pakets/:id_paket_soal

    // ---------------------------------------------------------
    // 🛡️ LAPIS 1: AMBIL DATA EVENT & CEK STATUS PENDAFTARAN
    // ---------------------------------------------------------
    const event = await prisma.event.findUnique({
      where: { id_event },
      include: {
        pendaftar: {
          where: { id_subscriber },
        },
        eventPaket: {
          orderBy: { id_event_paket: "asc" }, // Pastikan urut untuk cek berantai
          include: {
            paketSoal: {
              include: {
                paketAttempt: {
                  where: {
                    subscribers_id_subscriber: id_subscriber,
                    id_event: id_event,
                  },
                  orderBy: { started_at: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ message: "Event tidak ditemukan" });
    }

    if (event.pendaftar.length === 0) {
      return res.status(403).json({
        is_locked: true,
        message: "Akses ditolak. Anda belum mendaftar di event ini.",
      });
    }

    // ---------------------------------------------------------
    // 🛡️ LAPIS 2: GATEKEEPER WAKTU EVENT
    // ---------------------------------------------------------
    const now = new Date();
    const startDate = new Date(event.tanggal_mulai);
    const endDate = new Date(event.tanggal_selesai);

    if (now < startDate) {
      return res.status(403).json({
        is_locked: true,
        message: "Ujian ditolak: Event belum dimulai.",
      });
    }
    if (now > endDate) {
      return res.status(403).json({
        is_time_up: true,
        message: "Ujian ditolak: Event sudah berakhir.",
      });
    }

    // ---------------------------------------------------------
    // 🛡️ LAPIS 3: GATEKEEPER STATUS SELESAI & GEMBOK BERANTAI
    // ---------------------------------------------------------
    const eventPakets = event.eventPaket;
    const currentIndex = eventPakets.findIndex(
      (ep) => ep.id_paket_soal === id_paket_soal,
    );

    if (currentIndex === -1) {
      return res
        .status(404)
        .json({ message: "Paket soal tidak ditemukan dalam event ini." });
    }

    const currentPaketData = eventPakets[currentIndex].paketSoal;
    const currentAttempt = currentPaketData.paketAttempt[0];

    // Cek A: Apakah paket ini SUDAH PERNAH DIKERJAKAN sampai selesai?
    if (currentAttempt && currentAttempt.finished_at != null) {
      return res.status(403).json({
        is_locked: true,
        message:
          "Anda sudah menyelesaikan paket soal ini dan tidak dapat mengulanginya.",
      });
    }

    // Cek B: Apakah paket SEBELUMNYA sudah selesai? (Jika ini bukan paket pertama)
    if (currentIndex > 0) {
      const prevPaketData = eventPakets[currentIndex - 1].paketSoal;
      const prevAttempt = prevPaketData.paketAttempt[0];

      if (!prevAttempt || prevAttempt.finished_at == null) {
        return res.status(403).json({
          is_locked: true,
          message: `Selesaikan paket '${prevPaketData.nama_paket}' terlebih dahulu.`,
        });
      }
    }

    // ---------------------------------------------------------
    // ✅ JIKA LOLOS SEMUA GATEKEEPER: AMBIL SOAL & SISA WAKTU
    // ---------------------------------------------------------

    // Hitung sisa waktu event (Global Timer) dalam detik
    const sisa_waktu_detik = Math.floor(
      (endDate.getTime() - now.getTime()) / 1000,
    );

    // Ambil detail soal beserta opsinya
    const paketSoalDetail = await prisma.paketSoal.findUnique({
      where: { id_paket_soal },
      include: {
        soalPaket: {
          orderBy: { id_soal_paket_soal: "asc" },
          include: {
            soal: {
              include: {
                jawaban: { orderBy: { id_jawaban: "asc" } },
              },
            },
          },
        },
      },
    });

    // Format Soal (Sembunyikan kunci jawaban)
    const formattedSoal = paketSoalDetail.soalPaket.map((sp) => {
      const s = sp.soal;
      let formattedOptions = [];

      if (s.jenis_soal !== "short_answer") {
        formattedOptions = s.jawaban.map((j) => ({
          id: j.id_jawaban,
          text: j.opsi_jawaban_text,
          image: j.path_gambar_jawaban,
          // Ingat: Jangan kirim status benar/salah!
        }));
      }

      return {
        id_soal_paket_soal: sp.id_soal_paket_soal,
        point: sp.point,
        soal: {
          id_soal: s.id_soal,
          text_soal: s.text_soal,
          jenis_soal: s.jenis_soal,
          options: formattedOptions,
        },
      };
    });

    res.status(200).json({
      status: "success",
      data: {
        id_paket_soal,
        nama_paket: paketSoalDetail.nama_paket,
        sisa_waktu_detik: sisa_waktu_detik,
        soal_paket_soal: formattedSoal,
      },
    });
  } catch (error) {
    console.error("Error Get Event Paket Detail:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

exports.getEventUserReport = async (req, res) => {
  try {
    const id_subscriber = parseInt(req.user.id);
    const id_event = parseInt(req.params.id_event); // Misal dari URL: /events/:id_event/report

    // 1. Ambil Data Event beserta Paket Soal & Jumlah Soal
    const event = await prisma.event.findUnique({
      where: { id_event },
      include: {
        eventPaket: {
          orderBy: { id_event_paket: "asc" }, // Agar urutan paketnya sesuai (Paket 1, Paket 2, dll)
          include: {
            paketSoal: {
              include: {
                _count: { select: { soalPaket: true } }, // Hitung total soal di paket ini
              },
            },
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ message: "Event tidak ditemukan." });
    }

    // 2. Ambil Semua Pengerjaan (Attempt) User di Event Ini DENGAN soal details
    const userAttempts = await prisma.paketAttempt.findMany({
      where: {
        id_event: id_event,
        subscribers_id_subscriber: id_subscriber,
        finished_at: { not: null }, // Hanya hitung yang sudah selesai di-submit
      },
      include: {
        history: true,
        paketSoal: {
          include: {
            soalPaket: {
              include: {
                soal: {
                  include: { jawaban: true },
                },
              },
            },
          },
        },
      },
    });

    // 3. Siapkan Variabel Penampung untuk Akumulasi "Semua Paket"
    let totalAllSoal = 0;
    let totalAllBenar = 0;
    let totalAllSalah = 0;
    let totalAllLewat = 0;

    // Objek utama yang akan dikirim ke Frontend
    const reportData = {};

    // 4. Kalkulasi Per Paket Soal (tanpa async/await loops)
    for (let i = 0; i < event.eventPaket.length; i++) {
      const ep = event.eventPaket[i];
      const paket = ep.paketSoal;
      const totalSoal = paket._count.soalPaket;

      // Cari attempt user untuk paket ini
      const attempt = userAttempts.find(
        (a) => a.paket_soal_id_paket_soal === paket.id_paket_soal,
      );

      let benar = 0;
      let salah = 0;
      let lewat = totalSoal; // Default dilewati semua
      let score = 0;

      if (attempt && attempt.history && attempt.paketSoal) {
        // Hitung per soal (bukan per history entry)
        for (const soalPaket of attempt.paketSoal.soalPaket) {
          // Cari semua history entries untuk soal ini
          const soalHistories = attempt.history.filter(
            (h) => h.id_soal_paket_soal === soalPaket.id_soal_paket_soal,
          );

          if (soalHistories.length === 0) {
            // Soal tidak dikerjakan - lewati
            lewat--;
          } else {
            // Soal dikerjakan, cek apakah benar atau salah berdasarkan soal type
            const soal = soalPaket.soal;
            const correctAnswerIds = soal.jawaban
              .filter((j) => j.status === true)
              .map((j) => j.id_jawaban);

            const userAnswerIds = soalHistories.map((h) => h.id_jawaban);

            let soalBenar = false;

            if (soal.jenis_soal === "multiple_answer") {
              // Untuk multiple_answer: user harus pilih PERSIS jawaban yang benar
              if (
                userAnswerIds.length === correctAnswerIds.length &&
                userAnswerIds.every((id) => correctAnswerIds.includes(id))
              ) {
                soalBenar = true;
              }
            } else {
              // Untuk single answer: cukup satu yang benar
              soalBenar = userAnswerIds.some((id) =>
                correctAnswerIds.includes(id),
              );
            }

            if (soalBenar) {
              benar++;
            } else {
              salah++;
            }

            // Update lewat count
            lewat--;
          }
        }
        // Hitung skor paket (Benar / Total Soal * 100)
        score = totalSoal > 0 ? Math.round((benar / totalSoal) * 100) : 0;
      }

      // Akumulasi ke Total Keseluruhan
      totalAllSoal += totalSoal;
      totalAllBenar += benar;
      totalAllSalah += salah;
      totalAllLewat += lewat;

      // Masukkan ke object response dengan key unik (misal: "paket_12", dsb)
      // Key ini akan digunakan oleh Frontend di elemen <select> dropdown
      reportData[`paket_${paket.id_paket_soal}`] = {
        title: `Paket ${i + 1}: ${paket.nama_paket}`,
        slug: slugify(paket.nama_paket), // Fungsi slugify (harus buat helper atau ganti pakai ID)
        paketId: paket.id_paket_soal,
        score,
        benar,
        salah,
        lewat,
        totalSoal,
      };
    }

    // 5. Kalkulasi Skor Keseluruhan Event
    const allScore =
      totalAllSoal > 0 ? Math.round((totalAllBenar / totalAllSoal) * 100) : 0;

    // Tambahkan data "all" ke object response
    reportData["all"] = {
      title: "Rata-rata Keseluruhan Event",
      score: allScore,
      benar: totalAllBenar,
      salah: totalAllSalah,
      lewat: totalAllLewat,
      totalSoal: totalAllSoal,
    };

    // 6. Kirim Response
    res.status(200).json({
      status: "success",
      data: {
        event_title: event.nama_event,
        report: reportData,
      },
    });
  } catch (error) {
    console.error("Get Event User Report Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// --- HELPER FUNCTION (Letakkan di luar atau gunakan library) ---
function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Ganti spasi dengan -
    .replace(/[^\w\-]+/g, "") // Hapus semua karakter non-word
    .replace(/\-\-+/g, "-") // Ganti multiple - dengan satu -
    .replace(/^-+/, "") // Trim - dari awal
    .replace(/-+$/, ""); // Trim - dari akhir
}

exports.getEventLeaderboard = async (req, res) => {
  try {
    const id_event = parseInt(req.params.id_event);
    const paketId = req.query.paketId || "all"; // 'all' atau ID paket spesifik

    // 1. Ambil detail event untuk mengetahui "Total Soal Target"
    const event = await prisma.event.findUnique({
      where: { id_event },
      include: {
        eventPaket: {
          include: {
            paketSoal: {
              include: {
                _count: { select: { soalPaket: true } },
              },
            },
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ message: "Event tidak ditemukan." });
    }

    // Hitung target maksimal soal (Sebagai pembagi nilai)
    let totalSoalTarget = 0;
    if (paketId === "all") {
      // Jika "all", jumlahkan semua soal dari seluruh paket di event
      totalSoalTarget = event.eventPaket.reduce(
        (sum, ep) => sum + ep.paketSoal._count.soalPaket,
        0,
      );
    } else {
      // Jika spesifik, ambil jumlah soal dari paket itu saja
      const targetPaket = event.eventPaket.find(
        (ep) => ep.paketSoal.id_paket_soal === parseInt(paketId),
      );
      if (!targetPaket)
        return res.status(404).json({ message: "Paket tidak valid." });
      totalSoalTarget = targetPaket.paketSoal._count.soalPaket;
    }

    // 2. Ambil semua pengerjaan (attempt) yang SUDAH SELESAI di event ini
    const whereClause = {
      id_event: id_event,
      finished_at: { not: null },
    };

    // Filter paket jika bukan "all"
    if (paketId !== "all") {
      whereClause.paket_soal_id_paket_soal = parseInt(paketId);
    }

    const attempts = await prisma.paketAttempt.findMany({
      where: whereClause,
      include: {
        subscriber: {
          select: { id_subscriber: true, nama_subscriber: true, foto: true },
        },
        history: true,
        paketSoal: {
          include: {
            soalPaket: {
              include: {
                soal: {
                  include: { jawaban: true },
                },
              },
            },
          },
        },
      },
    });

    // 3. AGREGASI DATA (Kelompokkan berdasarkan User)
    // Karena satu user bisa mengerjakan 3 paket, kita harus menggabungkan nilainya.
    const userStats = new Map();

    attempts.forEach((attempt) => {
      const userId = attempt.subscribers_id_subscriber;

      if (!userStats.has(userId)) {
        userStats.set(userId, {
          id_subscriber: userId,
          name: attempt.subscriber.nama_subscriber || "Peserta Event",
          avatar: attempt.subscriber.foto || "/person.jpg",
          benar: 0,
          totalDurasi: 0,
        });
      }

      const stats = userStats.get(userId);

      // Hitung jawaban benar PER SOAL (bukan per history entry)
      // untuk handle multiple_answer correctly
      let attemptBenar = 0;

      if (attempt.paketSoal && attempt.paketSoal.soalPaket) {
        for (const soalPaket of attempt.paketSoal.soalPaket) {
          // Cari semua history entries untuk soal ini
          const soalHistories = attempt.history.filter(
            (h) => h.id_soal_paket_soal === soalPaket.id_soal_paket_soal,
          );

          if (soalHistories.length > 0) {
            // Soal dikerjakan, cek apakah benar atau salah berdasarkan soal type
            const soal = soalPaket.soal;
            const correctAnswerIds = soal.jawaban
              .filter((j) => j.status === true)
              .map((j) => j.id_jawaban);

            const userAnswerIds = soalHistories.map((h) => h.id_jawaban);

            let soalBenar = false;

            if (soal.jenis_soal === "multiple_answer") {
              // Untuk multiple_answer: user harus pilih PERSIS jawaban yang benar
              if (
                userAnswerIds.length === correctAnswerIds.length &&
                userAnswerIds.every((id) => correctAnswerIds.includes(id))
              ) {
                soalBenar = true;
              }
            } else {
              // Untuk single answer: cukup satu yang benar
              soalBenar = userAnswerIds.some((id) =>
                correctAnswerIds.includes(id),
              );
            }

            if (soalBenar) {
              attemptBenar++;
            }
          }
        }
      }

      stats.benar += attemptBenar;

      // Hitung durasi (Waktu Selesai - Waktu Mulai) dalam milidetik
      const start = new Date(attempt.started_at).getTime();
      const finish = new Date(attempt.finished_at).getTime();
      stats.totalDurasi += finish - start;
    });

    // 4. Kalkulasi Skor Akhir & Format Data
    const leaderboard = Array.from(userStats.values()).map((user) => {
      // Skor = (Total Benar / Total Soal Target) * 100
      const score =
        totalSoalTarget > 0
          ? Math.round((user.benar / totalSoalTarget) * 100)
          : 0;

      return {
        id_subscriber: user.id_subscriber,
        name: user.name,
        avatar: user.avatar,
        stats: `${user.benar}/${totalSoalTarget}`, // Tampilan "15/20"
        score: score,
        _durasiSistem: user.totalDurasi, // Tie-breaker rahasia
      };
    });

    // 5. SORTING: Skor Tertinggi -> Durasi Tercepat
    leaderboard.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score; // Prioritas 1: Skor
      }
      return a._durasiSistem - b._durasiSistem; // Prioritas 2: Durasi tersingkat
    });

    // 6. Beri nomor ranking dan hapus durasi rahasia sebelum kirim ke FE
    const finalLeaderboard = leaderboard.map((user, index) => {
      const { _durasiSistem, ...cleanData } = user;
      return {
        no: index + 1,
        ...cleanData,
      };
    });

    res.status(200).json({
      status: "success",
      data: finalLeaderboard,
    });
  } catch (error) {
    console.error("Get Event Leaderboard Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};
