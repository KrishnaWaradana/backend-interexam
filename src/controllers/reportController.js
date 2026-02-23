const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { startOfWeek, startOfMonth, startOfYear, format } = require('date-fns');


const getReportData = async (req, res) => {
    try {
        const { period } = req.query;
        
        // Mengambil ID dan Role dari middleware auth
        const id_user = req.user.id_user || req.user.id;
        const role = req.user.role; 

        if (!id_user) {
            return res.status(401).json({ message: "Sesi tidak valid." });
        }

        // 1. Logika Rentang Waktu
        const now = new Date();
        let startDate;
        if (period === 'week') {
            startDate = startOfWeek(now, { weekStartsOn: 1 });
        } else if (period === 'month') {
            startDate = startOfMonth(now);
        } else {
            startDate = startOfYear(now);
        }

        const startDateISO = startDate.toISOString();

        // 2. KUNCI FILTER: Logika Privasi sesuai Role
        let soalWhereClause = {
            tanggal_pembuatan: { gte: startDateISO }
        };

        if (role === 'Contributor') {
            // Hanya miliknya sendiri (bebas status apapun)
            soalWhereClause.id_contributor = id_user;
        } 
        else if (role === 'Validator') {
            // Hanya soal yang berhubungan dengan ID validator ini di tabel validasi
            soalWhereClause.validasi = {
                some: { id_validator: id_user }
            };
        } 
        else if (role === 'Admin') {
            // Admin lihat semua, tapi dilarang lihat yang masih 'draft'
            soalWhereClause.status = { not: 'draft' };
        }

        // 3. Query Summary (Stat Cards)
        const [totalSub, totalPaket, totalEvent, incomeAgg] = await Promise.all([
            prisma.subscribers.count(),
            prisma.paketSoal.count({ 
                where: role === 'Admin' ? {} : { id_creator: id_user } 
            }),
            prisma.event.count(),
            prisma.transaksi.aggregate({
                _sum: { amount: true },
                where: { 
                    status: 'settlement',
                    ...(role === 'Admin' ? {} : { id_subscriber: id_user }) 
                }
            })
        ]);

        // 4. Query Bar Chart (Soal per Subject)
        const subjects = await prisma.subjects.findMany({
            select: {
                nama_subject: true,
                topics: {
                    select: {
                        _count: {
                            select: { 
                                soal: { where: soalWhereClause } 
                            }
                        }
                    }
                }
            }
        });

        const barData = subjects.map(s => ({
            label: s.nama_subject,
            value: s.topics.reduce((acc, curr) => acc + curr._count.soal, 0)
        })).filter(item => item.value > 0);

        // 5. Query Donut Chart (Status Soal)
        const totalSoal = await prisma.soal.count({ where: soalWhereClause });
        const approvedSoal = await prisma.soal.count({ 
            where: { 
                ...soalWhereClause, 
                status: 'disetujui' 
            } 
        });

        // 6. Query Line Chart (Pendapatan)
        const transactions = await prisma.transaksi.findMany({
            where: { 
                ...(role === 'Admin' ? {} : { id_subscriber: id_user }),
                status: 'settlement',
                created_at: { gte: startDate }
            },
            orderBy: { created_at: 'asc' }
        });

        const revenueMap = {};
        transactions.forEach(t => {
            const key = format(t.created_at, period === 'year' ? 'MMM' : 'dd MMM');
            revenueMap[key] = (revenueMap[key] || 0) + Number(t.amount);
        });

        // 7. Response JSON Final
        res.json({
            summary: {
                totalSub,
                totalPaket,
                totalIncome: incomeAgg._sum.amount || 0,
                totalEvent
            },
            filteredData: {
                lineData: {
                    current: Object.values(revenueMap).length ? Object.values(revenueMap) : [0],
                    labels: Object.keys(revenueMap).length ? Object.keys(revenueMap) : ['Belum ada data']
                },
                barData: barData.length ? barData : [{ label: 'N/A', value: 0 }],
                pieData: [
                    { label: "Disetujui", value: approvedSoal, color: "#60a5fa" },
                    { label: "Proses/Lainnya", value: totalSoal - approvedSoal, color: "#9ca3af" }
                ],
                donutPercent: totalSoal > 0 ? Math.round((approvedSoal / totalSoal) * 100) : 0
            }
        });

    } catch (error) {
        console.error("ERROR_REPORT:", error);
        res.status(500).json({ 
            message: "Gagal memproses laporan", 
            error: error.message 
        });
    }
};

module.exports = { getReportData };