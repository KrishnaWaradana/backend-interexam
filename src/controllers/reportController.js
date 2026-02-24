const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { 
    startOfMonth, endOfMonth, startOfYear, endOfYear, 
    format, eachDayOfInterval, eachMonthOfInterval, 
    subDays, subMonths, subYears, startOfWeek, endOfWeek, parseISO 
} = require('date-fns');

const getReportData = async (req, res) => {
    try {
        const { period = 'year' } = req.query;
        const now = new Date();
        let currentRange, lastRange, formatKey, intervals;

        // 1. SET RANGE WAKTU
        if (period === 'week') {
            currentRange = { start: startOfWeek(now), end: endOfWeek(now) };
            lastRange = { start: startOfWeek(subDays(now, 7)), end: endOfWeek(subDays(now, 7)) };
            formatKey = 'EEE';
            intervals = eachDayOfInterval(currentRange);
        } else if (period === 'month') {
            currentRange = { start: startOfMonth(now), end: endOfMonth(now) };
            lastRange = { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
            formatKey = 'dd MMM';
            intervals = eachDayOfInterval(currentRange);
        } else {
            currentRange = { start: startOfYear(now), end: endOfYear(now) };
            lastRange = { start: startOfYear(subYears(now, 1)), end: endOfYear(subYears(now, 1)) };
            formatKey = 'MMM';
            intervals = eachMonthOfInterval(currentRange);
        }

        // 2. QUERY DATABASE
        const [
            incomeCurrent, incomeLast,
            allSubscribers, // Ambil semua karena tidak ada created_at di model Subscribers
            subjects,
            totalEventCount,
            totalPaketCount,
            allSoal // Ambil soal untuk difilter manual karena field-nya String
        ] = await Promise.all([
            prisma.transaksi.findMany({ 
                where: { status: 'success', created_at: { gte: currentRange.start, lte: currentRange.end } }
            }),
            prisma.transaksi.findMany({ 
                where: { status: 'success', created_at: { gte: lastRange.start, lte: lastRange.end } }
            }),
            prisma.subscribers.findMany({
                include: { subscribePaket: true }
            }),
            prisma.subjects.findMany({
                include: { topics: { include: { soal: true } } }
            }),
            prisma.event.count({ where: { created_at: { gte: currentRange.start, lte: currentRange.end } } }),
            prisma.paketSoal.count(), // PaketSoal di schema Anda tidak punya default now, jadi ambil total
            prisma.soal.findMany() // Ambil semua soal karena tanggal_pembuatan adalah String
        ]);

        // 3. FILTERING MANUAL (Karena tipe data String/Missing di Prisma)
        
        // Filter Soal berdasarkan String tanggal_pembuatan
        const filteredSoal = allSoal.filter(s => {
            if (!s.tanggal_pembuatan) return false;
            const d = new Date(s.tanggal_pembuatan);
            return d >= currentRange.start && d <= currentRange.end;
        });

        const approvedSoal = filteredSoal.filter(s => s.status === 'disetujui').length;
        const rejectedSoal = filteredSoal.filter(s => s.status === 'ditolak').length;

        // 4. MAPPING REVENUE
        const currentMap = {};
        const lastMap = {};
        intervals.forEach(date => { currentMap[format(date, formatKey)] = 0; });

        incomeCurrent.forEach(t => {
            const label = format(t.created_at, formatKey);
            if (currentMap.hasOwnProperty(label)) currentMap[label] += Number(t.amount) || 0;
        });

        incomeLast.forEach(t => {
            const label = format(t.created_at, formatKey);
            lastMap[label] = (lastMap[label] || 0) + (Number(t.amount) || 0);
        });

        // 5. MAPPING BAR DATA (Berdasarkan filteredSoal)
        const barData = subjects.map(s => {
            let count = 0;
            s.topics.forEach(t => {
                const soalInTopic = t.soal.filter(so => {
                    const d = new Date(so.tanggal_pembuatan);
                    return d >= currentRange.start && d <= currentRange.end;
                });
                count += soalInTopic.length;
            });
            return { label: s.nama_subject, value: count };
        }).filter(b => b.value > 0);

        // 6. RESPONSE
        return res.status(200).json({
            success: true,
            summary: {
                totalSub: allSubscribers.length, // Karena tidak ada filter date di schema
                totalPaket: totalPaketCount,
                totalIncome: incomeCurrent.reduce((acc, curr) => acc + curr.amount, 0),
                totalSoal: filteredSoal.length,
                totalEvent: totalEventCount
            },
            filteredData: {
                lineData: {
                    labels: Object.keys(currentMap),
                    current: Object.values(currentMap),
                    last: Object.keys(currentMap).map(k => lastMap[k] || 0)
                },
                pieData: [
                    { label: "Aktif", value: allSubscribers.filter(s => s.subscribePaket.some(p => p.status === 'active')).length, color: "#60a5fa" },
                    { label: "Non-Aktif", value: allSubscribers.filter(s => !s.subscribePaket.some(p => p.status === 'active')).length, color: "#9ca3af" }
                ],
                barData: barData,
                donutPercent: (approvedSoal + rejectedSoal) > 0 ? Math.round((approvedSoal / (approvedSoal + rejectedSoal)) * 100) : 0
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};

module.exports = { getReportData };