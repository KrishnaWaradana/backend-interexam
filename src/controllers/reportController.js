const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { 
    startOfMonth, endOfMonth, startOfYear, endOfYear, 
    format, eachDayOfInterval, eachMonthOfInterval, subDays 
} = require('date-fns');

const getReportData = async (req, res) => {
    try {
        const { period = 'year' } = req.query;
        
        // --- LOGIKA TEST ID 13 ---
        const userId = req.user?.id_user || req.user?.id || parseInt(req.headers['x-test-id']) || 13;
        const userRole = req.user?.role || req.headers['x-test-role'] || 'Admin';

        const now = new Date();
        let startDate, endDate, formatKey, intervals;

        if (period === 'week') {
            startDate = subDays(now, 13); 
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

        // 2. QUERY DATABASE (FOKUS DISETUJUI & DITOLAK)
        const [
            incomeAgg, 
            transactions, 
            totalSub, 
            activeSubs, 
            subjects, 
            totalSoalCount,
            totalEventCount,
            totalPaketCount,
            approvedSoal, // Status: disetujui
            rejectedSoal  // Status: ditolak
        ] = await Promise.all([
            prisma.transaksi.aggregate({
                _sum: { amount: true },
                where: { status: 'success' }
            }),
            prisma.transaksi.findMany({
                where: { 
                    status: 'success', 
                    created_at: { gte: startDate, lte: endDate } 
                }
            }),
            prisma.subscribers.count(),
            prisma.subscribers.count({
                where: { subscribePaket: { some: { status: 'active' } } }
            }),
            prisma.subjects.findMany({
                select: {
                    nama_subject: true,
                    topics: { select: { _count: { select: { soal: true } } } }
                }
            }),
            prisma.soal.count(),
            prisma.event.count(),
            prisma.paketSoal.count(),
            // Filter Status Soal
            prisma.soal.count({ where: { status: 'disetujui' } }),
            prisma.soal.count({ where: { status: 'ditolak' } })
        ]);

        // 3. MAPPING REVENUE
        const revenueMap = {};
        intervals.forEach(date => { revenueMap[format(date, formatKey)] = 0; });
        transactions.forEach(t => {
            const label = format(t.created_at, formatKey);
            if (revenueMap.hasOwnProperty(label)) {
                revenueMap[label] += Number(t.amount) || 0;
            }
        });

        // 4. RESPONSE JSON
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
                    current: Object.values(revenueMap),
                    labels: Object.keys(revenueMap)
                },
                pieData: [
                    { label: "Aktif", value: activeSubs || 0, color: "#60a5fa" },
                    { label: "Non-Aktif", value: Math.max(0, (totalSub || 0) - (activeSubs || 0)), color: "#9ca3af" }
                ],
                barData: subjects.map(s => ({
                    label: s.nama_subject,
                    value: s.topics.reduce((acc, curr) => acc + curr._count.soal, 0)
                })).filter(i => i.value > 0),
                
                // GRAFIK BULAT: DISESUAIKAN HANYA DISETUJUI & DITOLAK
                statusSoalChart: [
                    { label: "Disetujui", value: approvedSoal, color: "#10b981" },
                    { label: "Ditolak", value: rejectedSoal, color: "#ef4444" }
                ],
                // Persentase Berdasarkan Soal yang Sudah Diproses (Disetujui / (Disetujui + Ditolak))
                donutPercent: (approvedSoal + rejectedSoal) > 0 
                    ? Math.round((approvedSoal / (approvedSoal + rejectedSoal)) * 100) 
                    : 0
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getReportData };