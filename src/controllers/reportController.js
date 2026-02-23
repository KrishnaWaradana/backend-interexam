const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { 
    startOfMonth, endOfMonth, startOfYear, endOfYear, 
    format, eachDayOfInterval, eachMonthOfInterval, subDays 
} = require('date-fns');

const getReportData = async (req, res) => {
    try {
        const { period = 'year' } = req.query;
        
        // Menggunakan ID dari user yang sedang login
        const userId = req.user?.id_user || req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const now = new Date();
        let startDate, endDate, formatKey, intervals;

        if (period === 'week') {
            startDate = subDays(now, 6); 
            endDate = now;
            formatKey = 'dd MMM';
            intervals = eachDayOfInterval({ start: startDate, end: endDate });
        } else if (period === 'month') {
            startDate = startOfMonth(now);
            endDate = endOfMonth(now);
            formatKey = 'dd MMM';
            intervals = eachDayOfInterval({ start: startDate, end: endDate });
        } else {
            startDate = startOfYear(now);
            endDate = endOfYear(now);
            formatKey = 'MMM';
            intervals = eachMonthOfInterval({ start: startDate, end: endDate });
        }

        const [
            incomeAgg, transactions, totalSub, activeSubs, 
            subjects, totalSoalCount, totalEventCount, 
            totalPaketCount, approvedSoal, rejectedSoal
        ] = await Promise.all([
            prisma.transaksi.aggregate({ _sum: { amount: true }, where: { status: 'success' } }),
            prisma.transaksi.findMany({ 
                where: { status: 'success', created_at: { gte: startDate, lte: endDate } },
                orderBy: { created_at: 'asc' }
            }),
            prisma.subscribers.count(),
            prisma.subscribers.count({ where: { subscribePaket: { some: { status: 'active' } } } }),
            prisma.subjects.findMany({
                select: {
                    nama_subject: true,
                    topics: { select: { _count: { select: { soal: true } } } }
                }
            }),
            prisma.soal.count(),
            prisma.event.count(),
            prisma.paketSoal.count(),
            prisma.soal.count({ where: { status: 'disetujui' } }),
            prisma.soal.count({ where: { status: 'ditolak' } })
        ]);

        // PROTEKSI: Pastikan revenueMap selalu terisi label tanggal
        const revenueMap = {};
        intervals.forEach(date => {
            revenueMap[format(date, formatKey)] = 0;
        });

        transactions.forEach(t => {
            const label = format(t.created_at, formatKey);
            if (revenueMap.hasOwnProperty(label)) {
                revenueMap[label] += Number(t.amount) || 0;
            }
        });

        const barData = subjects.map(s => ({
            label: s.nama_subject || "N/A",
            value: s.topics.reduce((acc, curr) => acc + curr._count.soal, 0)
        })).filter(item => item.value > 0);

        // PERSENTASE DONUT
        const processedSoal = approvedSoal + rejectedSoal;
        const donutPercent = processedSoal > 0 
            ? Math.round((approvedSoal / processedSoal) * 100) 
            : 0;

        // RESPONSE JSON: Memberikan nilai default [] atau 0 agar Frontend tidak crash
        return res.status(200).json({
            success: true,
            summary: {
                totalSub: totalSub || 0,
                totalPaket: totalPaketCount || 0,
                totalIncome: Number(incomeAgg._sum.amount) || 0,
                totalSoal: totalSoalCount || 0,
                totalEvent: totalEventCount || 0
            },
            filteredData: {
                lineData: {
                    // Pakai Object.values/keys agar hasilnya pasti Array (Iterable)
                    current: Object.values(revenueMap).length > 0 ? Object.values(revenueMap) : [0],
                    labels: Object.keys(revenueMap).length > 0 ? Object.keys(revenueMap) : ["-"]
                },
                pieData: [
                    { label: "Aktif", value: activeSubs || 0, color: "#60a5fa" },
                    { label: "Non-Aktif", value: Math.max(0, (totalSub || 0) - (activeSubs || 0)), color: "#9ca3af" }
                ],
                barData: barData.length > 0 ? barData : [],
                donutPercent: donutPercent
            }
        });

    } catch (error) {
        console.error("REPORT_ERROR:", error);
        // Tetap kirim struktur data yang benar meski error agar FE tidak putih layarnya
        res.status(500).json({ 
            success: false, 
            filteredData: { lineData: { current: [], labels: [] } } 
        });
    }
};

module.exports = { getReportData };