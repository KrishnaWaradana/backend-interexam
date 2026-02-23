const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { 
    startOfMonth, endOfMonth, startOfYear, endOfYear, 
    format, eachDayOfInterval, eachMonthOfInterval, subDays 
} = require('date-fns');

const getReportData = async (req, res) => {
    try {
        const { period = 'year' } = req.query;
        
        // --- LOGIKA TEST: BISA JWT ATAU HEADER (KHUSUS TEST ID 13) ---
        const userId = req.user?.id_user || req.user?.id || parseInt(req.headers['x-test-id']) || 13;
        const userRole = req.user?.role || req.headers['x-test-role'] || 'Admin';

        const now = new Date();
        let startDate, endDate, formatKey, intervals;

        // 1. SET RANGE WAKTU (Interval agar chart tidak kosong)
        if (period === 'week') {
            startDate = subDays(now, 13); // 14 hari terakhir agar data Feb Mas masuk
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

        // 2. QUERY DATABASE (SEMUA REAL DARI DB)
        const [
            incomeAgg, 
            transactions, 
            totalSub, 
            activeSubs, 
            subjects, 
            totalSoalCount,
            totalEventCount, // <--- REAL DARI DB
            totalPaketCount
        ] = await Promise.all([
            // Hitung Pendapatan
            prisma.transaksi.aggregate({
                _sum: { amount: true },
                where: { status: 'success' }
            }),
            // Data Transaksi untuk Chart
            prisma.transaksi.findMany({
                where: { 
                    status: 'success', 
                    created_at: { gte: startDate, lte: endDate } 
                },
                orderBy: { created_at: 'asc' }
            }),
            // Total Data User/Paket/Event
            prisma.subscribers.count(),
            prisma.subscribers.count({
                where: { subscribePaket: { some: { status: 'active' } } }
            }),
            // Soal per Subject
            prisma.subjects.findMany({
                select: {
                    nama_subject: true,
                    topics: { select: { _count: { select: { soal: true } } } }
                }
            }),
            prisma.soal.count(),
            prisma.event.count(),      // <--- HITUNG TOTAL EVENT
            prisma.paketSoal.count()
        ]);

        // 3. MAPPING DATA REVENUE (Template Jan-Des)
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

        // Mapping Bar Chart (Soal per Mapel)
        const barData = subjects.map(s => ({
            label: s.nama_subject || "N/A",
            value: s.topics.reduce((acc, curr) => acc + curr._count.soal, 0)
        })).filter(item => item.value > 0);

        // 4. RESPONSE JSON PROFESIONAL
        return res.status(200).json({
            success: true,
            summary: {
                totalSub: totalSub || 0,
                totalPaket: totalPaketCount || 0,
                totalIncome: Number(incomeAgg._sum.amount) || 0,
                totalSoal: totalSoalCount || 0,
                totalEvent: totalEventCount // <--- HASIL DATABASE (Muncul angka, bukan string "4x")
            },
            filteredData: {
                lineData: {
                    current: Object.values(revenueMap),
                    labels: Object.keys(revenueMap)
                },
                pieData: [
                    { label: "Aktif", value: activeSubs || 0, color: "#60a5fa" },
                    { label: "Non-Aktif", value: Math.max(0, (totalSub || 0) - (activeSubs || 0)), color: "#9ca3af" }
                ],
                barData: barData.length ? barData : [{ label: 'N/A', value: 0 }]
            }
        });

    } catch (error) {
        console.error("REPORT_ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getReportData };