const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { 
    startOfMonth, endOfMonth, startOfYear, endOfYear, 
    format, eachDayOfInterval, eachMonthOfInterval, 
    subDays, subMonths, subYears, startOfWeek, endOfWeek 
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
            allSubscribers, 
            subjects,
            totalEventGlobal,
            totalPaketGlobal,
            allSoalGlobal, // Nama disamakan agar tidak error
            allTransactionsGlobal
        ] = await Promise.all([
            prisma.transaksi.findMany({ 
                where: { status: 'success', created_at: { gte: currentRange.start, lte: currentRange.end } }
            }),
            prisma.transaksi.findMany({ 
                where: { status: 'success', created_at: { gte: lastRange.start, lte: lastRange.end } }
            }),
            prisma.subscribers.findMany({ include: { subscribePaket: true } }),
            prisma.subjects.findMany({ include: { topics: { include: { soal: true } } } }),
            prisma.event.count(), 
            prisma.paketSoal.count(), 
            prisma.soal.findMany(), 
            prisma.transaksi.findMany({ where: { status: 'success' } })
        ]);

        // 3. MAPPING REVENUE (CHART)
        const currentMap = {};
        const lastMap = {};

        // Inisialisasi label di kedua map
        intervals.forEach(date => { 
            const label = format(date, formatKey);
            currentMap[label] = 0; 
            lastMap[label] = 0;
        });

        incomeCurrent.forEach(t => {
            const label = format(new Date(t.created_at), formatKey);
            if (currentMap.hasOwnProperty(label)) currentMap[label] += Number(t.amount) || 0;
        });

        incomeLast.forEach(t => {
            let labelCompare;
            const tDate = new Date(t.created_at);
            if (period === 'year') {
                labelCompare = format(tDate, 'MMM');
            } else if (period === 'week') {
                labelCompare = format(tDate, 'EEE');
            } else {
                const dayOnly = format(tDate, 'dd');
                labelCompare = Object.keys(currentMap).find(key => key.startsWith(dayOnly));
            }

            if (labelCompare && lastMap.hasOwnProperty(labelCompare)) {
                lastMap[labelCompare] += Number(t.amount) || 0;
            }
        });

        // 4. MAPPING BAR DATA (Berdasarkan filter periode saat ini)
        const barData = subjects.map(s => {
            let count = 0;
            s.topics.forEach(t => {
                const soalInTopic = t.soal.filter(so => {
                    if (!so.tanggal_pembuatan) return false;
                    const d = new Date(so.tanggal_pembuatan);
                    return d >= currentRange.start && d <= currentRange.end;
                });
                count += soalInTopic.length;
            });
            return { label: s.nama_subject, value: count };
        }).filter(b => b.value > 0);

        const finalSoalGlobal = allSoalGlobal.filter(s => s.status === 'disetujui' || s.status === 'ditolak');
        const approvedGlobal = finalSoalGlobal.filter(s => s.status === 'disetujui').length;

        return res.status(200).json({
            success: true,
            summary: {
                totalSub: allSubscribers.length,
                totalPaket: totalPaketGlobal,
                totalIncome: allTransactionsGlobal.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0),
                // SEKARANG INI AKAN JADI 6 (Jika memang ada 6 soal disetujui/ditolak di DB)
                totalSoal: finalSoalGlobal.length, 
                totalEvent: totalEventGlobal
            },
            filteredData: {
                lineData: {
                    labels: Object.keys(currentMap),
                    current: Object.values(currentMap), 
                    last: Object.values(lastMap)      
                },
                pieData: [
                    { label: "Aktif", value: allSubscribers.filter(s => s.subscribePaket.some(p => p.status === 'active')).length, color: "#60a5fa" },
                    { label: "Non-Aktif", value: allSubscribers.filter(s => !s.subscribePaket.some(p => p.status === 'active')).length, color: "#9ca3af" }
                ],
                barData: barData, 
                donutPercent: finalSoalGlobal.length > 0 
                    ? Math.round((approvedGlobal / finalSoalGlobal.length) * 100) 
                    : 0
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};

module.exports = { getReportData };