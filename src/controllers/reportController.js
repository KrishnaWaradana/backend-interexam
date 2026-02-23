const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { startOfWeek, startOfMonth, startOfYear, format } = require('date-fns');

const getReportData = async (req, res) => {
    try {
        const { period = 'year' } = req.query;
        const userId = req.user.id_user || req.user.id;
        const userRole = req.user.role;

        // 1. Setup Range Waktu
        const now = new Date();
        const dateMap = {
            week: startOfWeek(now, { weekStartsOn: 1 }),
            month: startOfMonth(now),
            year: startOfYear(now)
        };
        const startDate = dateMap[period] || dateMap.year;

        // 2. Filter Role (Berdasarkan Skema Soal kamu)
        const soalWhere = {};
        if (userRole === 'Contributor') soalWhere.id_contributor = userId;
        if (userRole === 'Validator') soalWhere.validasi = { some: { id_validator: userId } };
        if (userRole === 'Admin') soalWhere.status = { not: 'draft' };

        // 3. Parallel Database Queries
        const [
            totalSub, 
            totalPaket, 
            totalEvent, 
            incomeAgg, 
            subjects, 
            totalSoal, 
            approvedSoal, 
            transactions,
            activeSubCount // Query Subscriber Aktif Real-time
        ] = await Promise.all([
            prisma.subscribers.count(),
            prisma.paketSoal.count({ where: userRole === 'Admin' ? {} : { id_creator: userId } }),
            prisma.event.count(),
            // --- BAGIAN INI SUDAH DISINKRONKAN DENGAN GAMBAR PRISMA KAMU ---
            prisma.transaksi.aggregate({
                _sum: { amount: true },
                where: { 
                    status: 'success', // <--- Diganti dari 'settlement' ke 'success'
                    ...(userRole === 'Admin' ? {} : { id_subscriber: userId }) 
                }
            }),
            prisma.subjects.findMany({
                select: {
                    nama_subject: true,
                    topics: { select: { _count: { select: { soal: { where: soalWhere } } } } }
                }
            }),
            prisma.soal.count({ where: soalWhere }),
            prisma.soal.count({ where: { ...soalWhere, status: 'disetujui' } }),
            prisma.transaksi.findMany({
                where: { 
                    status: 'success', // <--- Sesuai database kamu
                    created_at: { gte: startDate },
                    ...(userRole === 'Admin' ? {} : { id_subscriber: userId }) 
                },
                orderBy: { created_at: 'asc' }
            }),
            // Menghitung subscriber yang punya paket berlangganan 'active'
            prisma.subscribers.count({
                where: {
                    subscribePaket: {
                        some: { status: 'active' }
                    }
                }
            })
        ]);

        // 4. Data Processing (Revenue per Waktu)
        const revenueMap = {};
        transactions.forEach(t => {
            const key = format(t.created_at, period === 'year' ? 'MMM' : 'dd MMM');
            revenueMap[key] = (revenueMap[key] || 0) + (Number(t.amount) || 0);
        });

        // 5. Subject Data Processing (Bar Chart)
        const barData = subjects.map(s => ({
            label: s.nama_subject || "N/A",
            value: s.topics.reduce((acc, curr) => acc + curr._count.soal, 0)
        })).filter(item => item.value > 0);

        // 6. Response JSON yang Bersih
        return res.status(200).json({
            success: true,
            summary: {
                totalSub,
                totalPaket,
                totalIncome: Number(incomeAgg._sum.amount) || 0,
                totalEvent
            },
            filteredData: {
                lineData: {
                    current: Object.values(revenueMap).length ? Object.values(revenueMap) : [0],
                    previous: [0],
                    labels: Object.keys(revenueMap).length ? Object.keys(revenueMap) : ['No Data']
                },
                pieData: [
                    { label: "Subscriber Aktif", value: activeSubCount, color: "#60a5fa" },
                    { label: "Non-Aktif", value: Math.max(0, totalSub - activeSubCount), color: "#9ca3af" }
                ],
                barData: barData.length ? barData : [{ label: 'N/A', value: 0 }],
                donutPercent: totalSoal > 0 ? Math.round((approvedSoal / totalSoal) * 100) : 0
            }
        });

    } catch (error) {
        console.error("[REPORT_ERROR]:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

module.exports = { getReportData };