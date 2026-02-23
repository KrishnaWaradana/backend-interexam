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

        // --- 1. SETUP RANGE WAKTU (AKALIN BIAR CHART GAK KOSONG) ---
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
            // Tahun: Paksa Muncul dari Januari sampai Desember
            startDate = startOfYear(now);
            endDate = endOfYear(now);
            intervals = eachMonthOfInterval({ start: startDate, end: endDate });
            formatKey = 'MMM';
        }

        // --- 2. DATABASE QUERIES (SESUAI CONTROLLER KAMU) ---
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
            prisma.users.count({ where: { role: 'User' } }), // Sesuaikan model user kamu
            prisma.paketLangganan.count(),
            prisma.transaksi.aggregate({
                _sum: { amount: true },
                where: { status_pembayaran: 'settlement' } // Pakai status sukses midtrans/db kamu
            }),
            // Query Soal per Subject (Logic Badak: Ambil semua lalu hitung di JS)
            prisma.subjects.findMany({
                include: {
                    topics: {
                        include: { _count: { select: { soal: true } } }
                    }
                }
            }),
            prisma.soal.count(),
            prisma.soal.count({ where: { status: 'disetujui' } }),
            // Query Pendapatan berdasar Range Waktu
            prisma.transaksi.findMany({
                where: { 
                    status_pembayaran: 'settlement', 
                    created_at: { gte: startDate, lte: endDate } 
                },
                orderBy: { created_at: 'asc' }
            }),
            // --- FIX SUBSCRIBER AKTIF ---
            // Mengikuti logic controller yang kamu kirim (status: 'active')
            prisma.userSubscription.count({
                where: {
                    status_pembayaran: 'settlement',
                    tanggal_berakhir: { gte: now }
                }
            })
        ]);

        // --- 3. MAPPING PENDAPATAN (LINE CHART) ---
        const revenueMap = {};
        
        // Inisialisasi label dulu (Biar Januari-Desember muncul walau data kosong)
        intervals.forEach(date => {
            const label = format(date, formatKey);
            revenueMap[label] = 0;
        });

        // Masukkan data dari transaksi
        transactions.forEach(t => {
            const label = format(new Date(t.created_at), formatKey);
            if (revenueMap.hasOwnProperty(label)) {
                revenueMap[label] += Number(t.amount) || 0;
            }
        });

        // --- 4. MAPPING BAR CHART (SOAL PER SUBJECT) ---
        const barData = subjectsData.map(s => {
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