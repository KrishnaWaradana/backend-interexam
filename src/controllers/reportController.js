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

        // --- 1. SETUP RANGE WAKTU (Ngakalin Chart Biar Selalu Ada Label) ---
        if (period === 'week') {
            startDate = subDays(now, 6); // 7 hari terakhir
            endDate = now;
            intervals = eachDayOfInterval({ start: startDate, end: endDate });
            formatKey = 'dd MMM';
        } else if (period === 'month') {
            startDate = startOfMonth(now);
            endDate = endOfMonth(now);
            intervals = eachDayOfInterval({ start: startDate, end: endDate });
            formatKey = 'dd MMM';
        } else {
            // Tahun: Paksa muncul Januari - Desember
            startDate = startOfYear(now);
            endDate = endOfYear(now);
            intervals = eachMonthOfInterval({ start: startDate, end: endDate });
            formatKey = 'MMM';
        }

        // --- 2. DATABASE QUERIES (Status: success) ---
        const [
            totalSub, 
            totalPaket, 
            incomeAgg, 
            subjectsData, 
            totalSoal, 
            approvedSoal, 
            transactions,
            activeSubCount
        ] = await Promise.all([
            // Hitung User dengan Role User (Subscriber)
            prisma.users.count({ where: { role: 'User' } }), 
            prisma.paketLangganan.count(),
            // Pendapatan Total (Status: success)
            prisma.transaksi.aggregate({
                _sum: { amount: true },
                where: { status: 'success' } 
            }),
            // Data Soal per Subject
            prisma.subjects.findMany({
                include: {
                    topics: {
                        include: { _count: { select: { soal: true } } }
                    }
                }
            }),
            prisma.soal.count(),
            prisma.soal.count({ where: { status: 'disetujui' } }),
            // Data Transaksi untuk Chart (Status: success)
            prisma.transaksi.findMany({
                where: { 
                    status: 'success', 
                    created_at: { gte: startDate, lte: endDate } 
                },
                orderBy: { created_at: 'asc' }
            }),
            // Subscriber Aktif (Cek yang punya paket belum expired & status success)
            prisma.userSubscription.count({
                where: {
                    status: 'success', // Pakai success sesuai database kamu
                    tanggal_berakhir: { gte: now }
                }
            })
        ]);

        // --- 3. MAPPING PENDAPATAN (LINE CHART) ---
        const revenueMap = {};
        
        // Buat laci kosong dulu (0) sesuai label waktu
        intervals.forEach(date => {
            const label = format(date, formatKey);
            revenueMap[label] = 0;
        });

        // Masukkan data transaksi asli ke laci yang pas
        transactions.forEach(t => {
            const label = format(new Date(t.created_at), formatKey);
            if (revenueMap.hasOwnProperty(label)) {
                revenueMap[label] += Number(t.amount) || 0;
            }
        });

        // --- 4. MAPPING BAR DATA (FIX TOTAL SOAL) ---
        const barData = subjectsData.map(s => {
            // Jumlahkan soal dari semua topik di bawah subjek ini
            const count = s.topics.reduce((acc, curr) => acc + (curr._count?.soal || 0), 0);
            return {
                label: s.nama_subject,
                value: count
            };
        }).filter(item => item.value > 0);

        // --- 5. RESPONSE ---
        return res.status(200).json({
            success: true,
            summary: {
                totalSub,
                totalPaket,
                totalIncome: Number(incomeAgg._sum.amount) || 0,
                totalSoal
            },
            filteredData: {
                lineData: {
                    labels: Object.keys(revenueMap),
                    current: Object.values(revenueMap)
                },
                barData: barData.length ? barData : [{ label: 'N/A', value: 0 }],
                pieData: [
                    { label: "Aktif", value: activeSubCount, color: "#60a5fa" },
                    { label: "Non-Aktif", value: Math.max(0, totalSub - activeSubCount), color: "#ef4444" }
                ],
                donutPercent: totalSoal > 0 ? Math.round((approvedSoal / totalSoal) * 100) : 0
            }
        });

    } catch (error) {
        console.error("REPORT_ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getReportData };