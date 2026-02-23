const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { 
    startOfWeek, startOfMonth, startOfYear, 
    format, eachDayOfInterval, eachMonthOfInterval, endOfMonth, endOfYear, subDays 
} = require('date-fns');

const getReportData = async (req, res) => {
    try {
        const { period = 'year' } = req.query;
        const now = new Date();
        
        let startDate, endDate, intervals, formatKey;

        // --- 1. MEMBUAT TEMPLATE WAKTU (AGAR CHART TIDAK KOSONG) ---
        if (period === 'week') {
            // Ambil 7 hari terakhir
            startDate = subDays(now, 6); 
            endDate = now;
            intervals = eachDayOfInterval({ start: startDate, end: endDate });
            formatKey = 'dd MMM';
        } else if (period === 'month') {
            // Ambil dari awal bulan ini sampai akhir bulan ini
            startDate = startOfMonth(now);
            endDate = endOfMonth(now);
            intervals = eachDayOfInterval({ start: startDate, end: endDate });
            formatKey = 'dd MMM';
        } else {
            // Tahun: Ambil dari Jan sampai Des
            startDate = startOfYear(now);
            endDate = endOfYear(now);
            intervals = eachMonthOfInterval({ start: startDate, end: endDate });
            formatKey = 'MMM';
        }

        // --- 2. QUERY DATABASE ---
        const [transactions, subjects, totalSub, activeSubCount, totalSoal, approvedSoal] = await Promise.all([
            prisma.transaksi.findMany({
                where: { 
                    status: 'success', 
                    created_at: { gte: startDate, lte: endDate } 
                }
            }),
            prisma.subjects.findMany({
                include: {
                    topics: {
                        include: { _count: { select: { soal: true } } }
                    }
                }
            }),
            prisma.subscribers.count(),
            prisma.subscribers.count({
                where: { subscribePaket: { some: { status: 'active' } } }
            }),
            prisma.soal.count(),
            prisma.soal.count({ where: { status: 'disetujui' } })
        ]);

        // --- 3. PROSES DATA PENDAPATAN (LOGIKA TEMPLATE) ---
        const revenueMap = {};
        
        // Buat "Wadah" kosong dulu (isinya 0) berdasarkan interval waktu
        intervals.forEach(date => {
            const label = format(date, formatKey);
            revenueMap[label] = 0; 
        });

        // Masukkan data transaksi asli ke dalam wadah yang sudah ada
        transactions.forEach(t => {
            const label = format(new Date(t.created_at), formatKey);
            if (revenueMap.hasOwnProperty(label)) {
                revenueMap[label] += Number(t.amount) || 0;
            }
        });

        // --- 4. PROSES BAR DATA (TOTAL SOAL PER SUBJECT) ---
        const barData = subjects.map(s => {
            const totalPerSubject = s.topics.reduce((acc, curr) => acc + (curr._count?.soal || 0), 0);
            return {
                label: s.nama_subject,
                value: totalPerSubject
            };
        }).filter(item => item.value > 0);

        // --- 5. RETURN DATA KE FRONTEND ---
        return res.status(200).json({
            success: true,
            summary: {
                totalSub,
                activeSub: activeSubCount,
                totalSoal,
                approvedRate: totalSoal > 0 ? Math.round((approvedSoal / totalSoal) * 100) : 0
            },
            filteredData: {
                lineData: {
                    // Ini pasti ada isinya, minimal angka 0 flat
                    labels: Object.keys(revenueMap), 
                    current: Object.values(revenueMap)
                },
                barData: barData.length ? barData : [{ label: 'N/A', value: 0 }],
                pieData: [
                    { label: "Aktif", value: activeSubCount, color: "#60a5fa" },
                    { label: "Non-Aktif", value: Math.max(0, totalSub - activeSubCount), color: "#ef4444" }
                ]
            }
        });

    } catch (error) {
        console.error("ERROR_REPORT:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getReportData };