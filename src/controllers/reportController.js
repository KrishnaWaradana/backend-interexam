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

        // 1. SET RANGE WAKTU (Untuk Pendapatan, Summary, dan Bar Chart)
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
            totalEventCount,
            totalPaketCount,
            allSoal 
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
            prisma.paketSoal.count(), 
            prisma.soal.findMany() 
        ]);

        // 3. FILTERING KHUSUS SOAL (Berdasarkan Waktu) untuk Summary & Bar Chart
        const filteredSoalByDate = allSoal.filter(s => {
            if (!s.tanggal_pembuatan) return false;
            const d = new Date(s.tanggal_pembuatan);
            return d >= currentRange.start && d <= currentRange.end;
        });

        // 4. LOGIKA STATUS SOAL (DARI SELURUH DATA - TIDAK TERFILTER WAKTU)
        const approvedSoalTotal = allSoal.filter(s => s.status === 'disetujui').length;
        const rejectedSoalTotal = allSoal.filter(s => s.status === 'ditolak').length;

        
        const currentMap = {};
        const lastMap = {};

        // Inisialisasi label dasar (Tahun tetap Jan-Dec, Minggu tetap Sen-Min, dst)
        intervals.forEach(date => { 
            const label = format(date, formatKey);
            currentMap[label] = 0; 
            lastMap[label] = 0; 
        });

        // Mapping Data Sekarang (Current)
        incomeCurrent.forEach(t => {
            const label = format(t.created_at, formatKey);
            if (currentMap.hasOwnProperty(label)) {
                currentMap[label] += Number(t.amount) || 0;
            }
        });

        
        incomeLast.forEach(t => {
            let labelCompare;
            
            if (period === 'year') {
                
                labelCompare = format(t.at, 'MMM');
            } else if (period === 'month') {
                
                const dayOnly = format(t.created_at, 'dd');
                
                labelCompare = Object.keys(currentMap).find(key => key.startsWith(dayOnly));
            } else if (period === 'week') {
                
                labelCompare = format(t.created_at, 'EEE');
            }

            if (labelCompare && lastMap.hasOwnProperty(labelCompare)) {
                lastMap[labelCompare] += Number(t.amount) || 0;
            }
        });

        
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

        // 7. RESPONSE
        return res.status(200).json({
            success: true,
            summary: {
                totalSub: allSubscribers.length,
                totalPaket: totalPaketCount,
                totalIncome: incomeCurrent.reduce((acc, curr) => acc + curr.amount, 0),
                totalSoal: filteredSoalByDate.length,
                totalEvent: totalEventCount
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
                // DonutPercent sekarang menggunakan total keseluruhan
                donutPercent: (approvedSoalTotal + rejectedSoalTotal) > 0 ? Math.round((approvedSoalTotal / (approvedSoalTotal + rejectedSoalTotal)) * 100) : 0
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};

module.exports = { getReportData };