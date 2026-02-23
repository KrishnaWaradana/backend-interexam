const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { startOfWeek, startOfMonth, startOfYear, format } = require('date-fns');

/**
 * Helper to build soal filter based on user role
 */
const getSoalFilters = (role, id_user, startDateISO) => {
    const baseFilter = { tanggal_pembuatan: { gte: startDateISO } };

    switch (role) {
        case 'Contributor':
            return { ...baseFilter, id_contributor: id_user };
        case 'Validator':
            return { 
                ...baseFilter, 
                validasi: { some: { id_validator: id_user } } 
            };
        case 'Admin':
            return { ...baseFilter, status: { not: 'draft' } };
        default:
            return baseFilter;
    }
};

const getReportData = async (req, res) => {
    try {
        const { period = 'year' } = req.query;
        const id_user = req.user.id_user || req.user.id;
        const role = req.user.role;

        if (!id_user) return res.status(401).json({ message: "Unauthorized access" });

        // 1. Time Range Setup
        const now = new Date();
        const dateMap = {
            week: startOfWeek(now, { weekStartsOn: 1 }),
            month: startOfMonth(now),
            year: startOfYear(now)
        };
        const startDate = dateMap[period] || dateMap.year;
        const startDateISO = startDate.toISOString();

        // 2. Build Dynamic Filters
        const soalWhereClause = getSoalFilters(role, id_user, startDateISO);
        const globalAccess = role === 'Admin';

        // 3. Parallel Database Queries
        const [totalSub, totalPaket, totalEvent, incomeAgg, subjects, totals, approvedCount, transactions] = await Promise.all([
            prisma.subscribers.count(),
            prisma.paketSoal.count({ where: globalAccess ? {} : { id_creator: id_user } }),
            prisma.event.count(),
            prisma.transaksi.aggregate({
                _sum: { amount: true },
                where: { status: 'settlement', ...(globalAccess ? {} : { id_subscriber: id_user }) }
            }),
            prisma.subjects.findMany({
                select: {
                    nama_subject: true,
                    topics: { select: { _count: { select: { soal: { where: soalWhereClause } } } } }
                }
            }),
            prisma.soal.count({ where: soalWhereClause }),
            prisma.soal.count({ where: { ...soalWhereClause, status: 'disetujui' } }),
            prisma.transaksi.findMany({
                where: { status: 'settlement', created_at: { gte: startDate }, ...(globalAccess ? {} : { id_subscriber: id_user }) },
                orderBy: { created_at: 'asc' }
            })
        ]);

        // 4. Data Transformation
        const barData = subjects
            .map(s => ({
                label: s.nama_subject,
                value: s.topics.reduce((acc, curr) => acc + curr._count.soal, 0)
            }))
            .filter(item => item.value > 0);

        const revenueMap = {};
        transactions.forEach(t => {
            const key = format(t.created_at, period === 'year' ? 'MMM' : 'dd MMM');
            revenueMap[key] = (revenueMap[key] || 0) + Number(t.amount);
        });

        // 5. Professional Response Structure
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
                barData: barData.length ? barData : [{ label: 'N/A', value: 0 }],
                pieData: [
                    { label: "Disetujui", value: approvedCount, color: "#60a5fa" },
                    { label: "Proses/Lainnya", value: totals - approvedCount, color: "#9ca3af" }
                ],
                donutPercent: totals > 0 ? Math.round((approvedCount / totals) * 100) : 0
            }
        });

    } catch (error) {
        console.error("[REPORT_CONTROLLER_ERROR]:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal Server Error", 
            error: process.env.NODE_ENV === 'development' ? error.message : undefined 
        });
    }
};

module.exports = { getReportData };