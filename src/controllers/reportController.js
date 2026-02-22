const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { startOfWeek, startOfMonth, startOfYear, endOfDay } = require('date-fns');

const getReportData = async (req, res) => {
    try {
        const { period } = req.query; // 'week', 'month', 'year'

        // --- 1. DATA KESELURUHAN (STAT CARD DI ATAS) ---
        const totalSub = await prisma.subscribers.count();
        const totalPaket = await prisma.paketSoal.count();
        const totalEvent = await prisma.event.count();
        
        const incomeAgg = await prisma.transaksi.aggregate({
            _sum: { amount: true },
            where: { status: 'settlement' }
        });

        // --- 2. LOGIKA TANGGAL UNTUK FILTER ---
        let startDate;
        let labels = [];
        const now = new Date();

        if (period === 'week') {
            startDate = startOfWeek(now, { weekStartsOn: 1 }); // Senin
            labels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
        } else if (period === 'month') {
            startDate = startOfMonth(now);
            labels = ["Mgg 1", "Mgg 2", "Mgg 3", "Mgg 4"];
        } else {
            startDate = startOfYear(now);
            labels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        }

        // --- 3. QUERY DATA TERFILTER ---
        
        // A. Bar Chart (Sudah berhasil tadi)
        const subjects = await prisma.subjects.findMany({
            include: {
                _count: { select: { topics: true } }
            }
        });

        // B. Line Chart (Pendapatan terfilter)
        const revenueData = await prisma.transaksi.findMany({
            where: { 
                created_at: { gte: startDate },
                status: 'settlement'
            },
            select: { amount: true, created_at: true }
        });

        // --- 4. KIRIM RESPONS ---
        res.json({
            summary: {
                totalSub,
                totalPaket,
                totalIncome: incomeAgg._sum.amount || 0,
                totalEvent
            },
            filteredData: {
                lineData: {
                    current: revenueData.map(r => r.amount), // Data asli
                    previous: [100000, 200000], // Dummy biar gak crash
                    labels: labels
                },
                legendText: period === 'week' ? ["Minggu Ini", "Minggu Lalu"] : ["Tahun Ini", "Tahun Lalu"],
                barData: subjects.map(s => ({
                    label: s.nama_subject,
                    value: s._count?.topics || 0
                })),
                pieData: [
                    { label: "Aktif", value: totalSub, color: "#60a5fa" },
                    { label: "Non-Aktif", value: 2, color: "#9ca3af" }
                ],
                donutPercent: 75 
            }
        });

    } catch (error) {
        console.error("DETAIL ERROR:", error);
        res.status(500).json({ message: "Error", error: error.message });
    }
};

module.exports = { getReportData };