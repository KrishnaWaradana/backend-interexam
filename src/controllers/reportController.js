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
            allSoalGlobal, 
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

        // 3. MAPPING REVENUE (Fixing Sinkronisasi Tanggal/Hari)
        const labels = intervals.map(date => format(date, formatKey));

        const currentData = intervals.map(date => {
            const targetDateStr = format(date, 'yyyy-MM-dd'); // Kunci tanggal hari ini
            return incomeCurrent
                .filter(t => format(new Date(t.created_at), 'yyyy-MM-dd') === targetDateStr)
                .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        });

        const lastData = intervals.map(date => {
            // Jika period mingguan, kita cari data yang TEPAT 7 hari sebelum label chart
            // Misal label chart "Mon" (1 Mar), kita cari data 22 Feb.
            let targetDateLast;
            if (period === 'week') {
                targetDateLast = format(subDays(date, 7), 'yyyy-MM-dd');
            } else if (period === 'month') {
                targetDateLast = format(subMonths(date, 1), 'yyyy-MM-dd');
            } else {
                targetDateLast = format(subYears(date, 1), 'yyyy-MM-dd');
            }

            return incomeLast
                .filter(t => {
                    const transDate = format(new Date(t.created_at), 'yyyy-MM-dd');
                    
                    // Untuk TAHUNAN, kita bandingkan Nama Bulan saja
                    if (period === 'year') {
                        return format(new Date(t.created_at), 'MMM') === format(date, 'MMM');
                    }
                    
                    // Untuk MINGGUAN & BULANAN, kita bandingkan tanggal hasil pengurangan tadi
                    return transDate === targetDateLast;
                })
                .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        });
        // 4. MAPPING BAR DATA (Hanya yg disetujui/ditolak di range waktu terpilih)
        const barData = subjects.map(s => {
            let count = 0;
            s.topics.forEach(t => {
                const soalInTopic = t.soal.filter(so => {
                    if (!so.tanggal_pembuatan) return false;
                    const d = new Date(so.tanggal_pembuatan);
                    const isProcessed = so.status === 'disetujui' || so.status === 'ditolak';
                    return d >= currentRange.start && d <= currentRange.end && isProcessed;
                });
                count += soalInTopic.length;
            });
            return { label: s.nama_subject, value: count };
        }).filter(b => b.value > 0);

        // 5. GLOBAL CALCULATION (Untuk Stat Card - Selalu Total)
        const globalFinalSoal = allSoalGlobal.filter(s => s.status === 'disetujui' || s.status === 'ditolak');
        const globalApproved = globalFinalSoal.filter(s => s.status === 'disetujui').length;

        // 6. RESPONSE
        return res.status(200).json({
            success: true,
            summary: {
                totalSub: allSubscribers.length,
                totalPaket: totalPaketGlobal,
                totalIncome: allTransactionsGlobal.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0),
                totalSoal: globalFinalSoal.length, 
                totalEvent: totalEventGlobal
            },
            filteredData: {
                lineData: {
                    labels: labels,
                    current: currentData, 
                    last: lastData      
                },
                pieData: [
                    { label: "Aktif", value: allSubscribers.filter(s => s.subscribePaket.some(p => p.status === 'active')).length, color: "#60a5fa" },
                    { label: "Non-Aktif", value: allSubscribers.filter(s => !s.subscribePaket.some(p => p.status === 'active')).length, color: "#9ca3af" }
                ],
                barData: barData, 
                donutPercent: globalFinalSoal.length > 0 
                    ? Math.round((globalApproved / globalFinalSoal.length) * 100) 
                    : 0
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};

module.exports = { getReportData };