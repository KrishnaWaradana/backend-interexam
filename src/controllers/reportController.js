const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { 
    startOfMonth, endOfMonth, startOfYear, endOfYear, 
    format, eachDayOfInterval, eachMonthOfInterval, 
    subDays, subMonths, subYears 
} = require('date-fns');

const getReportData = async (req, res) => {
    try {
        const { period = 'year' } = req.query; 
        const userId = req.user?.id_user || req.user?.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Silakan login ulang" });
        }

        const now = new Date();
        let startDate, endDate, formatKey, intervals;

        // 1. SET RENTANG WAKTU BERDASARKAN FILTER (Satu Range Saja)
        if (period === 'week') {
            startDate = subDays(now, 6); 
            endDate = now;
            formatKey = 'dd MMM';
            intervals = eachDayOfInterval({ start: startDate, end: endDate });
        } else if (period === 'last_week') {
            startDate = subDays(subDays(now, 7), 6); 
            endDate = subDays(now, 7);
            formatKey = 'dd MMM';
            intervals = eachDayOfInterval({ start: startDate, end: endDate });
        } else if (period === 'month') {
            startDate = startOfMonth(now);
            endDate = endOfMonth(now);
            formatKey = 'dd MMM';
            intervals = eachDayOfInterval({ start: startDate, end: endDate });
        } else if (period === 'last_month') {
            startDate = startOfMonth(subMonths(now, 1));
            endDate = endOfMonth(subMonths(now, 1));
            formatKey = 'dd MMM';
            intervals = eachDayOfInterval({ start: startDate, end: endDate });
        } else if (period === 'last_year') {
            startDate = startOfYear(subYears(now, 1));
            endDate = endOfYear(subYears(now, 1));
            formatKey = 'MMM';
            intervals = eachMonthOfInterval({ start: startDate, end: endDate });
        } else {
            // Default: Tahun Ini
            startDate = startOfYear(now);
            endDate = endOfYear(now);
            formatKey = 'MMM';
            intervals = eachMonthOfInterval({ start: startDate, end: endDate });
        }

        // 2. QUERY DATABASE (Semua pakai startDate & endDate yang sama)
        const [transactions, subjects, approvedSoal, rejectedSoal, activeSubs, totalSubs] = await Promise.all([
            // Chart Pendapatan
            prisma.transaksi.findMany({ 
                where: { status: 'success', created_at: { gte: startDate, lte: endDate } } 
            }),
            // Chart Mapel
            prisma.subjects.findMany({
                select: {
                    nama_subject: true,
                    topics: { select: { _count: { select: { soal: { where: { created_at: { gte: startDate, lte: endDate } } } } } } }
                }
            }),
            // Chart Status Soal
            prisma.soal.count({ where: { status: 'disetujui', created_at: { gte: startDate, lte: endDate } } }),
            prisma.soal.count({ where: { status: 'ditolak', created_at: { gte: startDate, lte: endDate } } }),
            // Subscriber Aktif (Punya paket yang masih berlaku di rentang tgl ini)
            prisma.subscribers.count({
                where: { subscribePaket: { some: { status: 'active', created_at: { lte: endDate }, end_date: { gte: startDate } } } }
            }),
            // Total Subscriber (Sampai batas tgl filter)
            prisma.subscribers.count({ where: { created_at: { lte: endDate } } })
        ]);

        // 3. MAPPING PENDAPATAN (Cuma 1 Garis: "current")
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

        // 4. MAPPING MAPEL
        const barData = subjects.map(s => ({
            label: s.nama_subject,
            value: s.topics.reduce((acc, curr) => acc + curr._count.soal, 0)
        })).filter(i => i.value > 0);

        // 5. RESPONSE FINAL
        return res.status(200).json({
            success: true,
            summary: {
                totalIncome: transactions.reduce((acc, curr) => acc + Number(curr.amount), 0),
                totalSoal: approvedSoal + rejectedSoal
            },
            filteredData: {
                lineData: {
                    current: Object.values(revenueMap),
                    labels: Object.keys(revenueMap)
                },
                pieData: [
                    { label: "Aktif", value: activeSubs, color: "#60a5fa" },
                    { label: "Non-Aktif", value: Math.max(0, totalSubs - activeSubs), color: "#9ca3af" }
                ],
                barData: barData,
                donutPercent: (approvedSoal + rejectedSoal) > 0 
                    ? Math.round((approvedSoal / (approvedSoal + rejectedSoal)) * 100) : 0
            }
        });

    } catch (error) {
        console.error("ERROR_LAPORAN:", error);
        res.status(500).json({ 
            success: false, 
            filteredData: { lineData: { current: [], labels: [] }, barData: [], pieData: [] } 
        });
    }
};

module.exports = { getReportData };