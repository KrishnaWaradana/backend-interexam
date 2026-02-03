const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Get Statistics Summary
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

// Get Streak Target
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

// Get Progress Analytics
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

// Get Recent Paket
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
