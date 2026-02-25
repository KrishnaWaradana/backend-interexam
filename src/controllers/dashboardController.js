const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { subMonths } = require('date-fns');

const getDashboardStats = async (req, res) => {
    try {
        const rawId = req.user.id_user || req.user.id;
        const role = req.user.role;

        if (!rawId || !role) {
            return res.status(401).json({ message: "Sesi tidak valid." });
        }

        const userIdInt = parseInt(rawId, 10);

        // LOGIKA WAKTU: Tepat 1 Bulan Terakhir
        const now = new Date();
        const oneMonthAgo = subMonths(now, 1);
        const oneMonthAgoISO = oneMonthAgo.toISOString(); // Untuk tabel Soal yang pakai String

        // ==========================================
        // 1. ADMIN DASHBOARD
        // ==========================================
        if (role === 'Admin') {
            const [
                totalSub, totalPaket, totalEvent, totalSoal, approvedSoal, pendingSoal,
                activeSub, income, recentSubsRaw
            ] = await Promise.all([
                prisma.subscribers.count(), // Seluruh akun subscriber 
                prisma.paketSoal.count({ where: { tanggal_dibuat: { gte: oneMonthAgo } } }),
                prisma.event.count({ where: { created_at: { gte: oneMonthAgo } } }),
                prisma.soal.count({ where: { tanggal_pembuatan: { gte: oneMonthAgoISO } } }),
                prisma.soal.count({ where: { status: 'disetujui', tanggal_pembuatan: { gte: oneMonthAgoISO } } }),
                prisma.soal.count({ where: { status: 'need_verification', tanggal_pembuatan: { gte: oneMonthAgoISO } } }),
                // Subscriber berlangganan
                prisma.subscribers.count({ 
                    where: { 
                        subscribePaket: { 
                            some: { 
                                status: 'active',
                            } 
                        } 
                    } 
                }),
                // Pendapatan 1 bulan terakhir
                prisma.transaksi.aggregate({
                  _sum: { amount: true },
                  where: { status: 'success', created_at: { gte: oneMonthAgo } }
                }),
                // Data Tabel: Subscriber yang beli paket 1 bln terakhir
                prisma.subscribePaket.findMany({
                    where: { tanggal_mulai: { gte: oneMonthAgo } },
                    include: { subscriber: true, paketLangganan: true },
                    orderBy: { tanggal_mulai: 'desc' }
                })
            ]);

            const recentSubs = recentSubsRaw.map(sub => ({
                id: sub.id_subscribe,
                nama: sub.subscriber?.nama_subscriber || sub.subscriber?.username || "Tanpa Nama",
                email: sub.subscriber?.email_subscriber || "-",
                no_tlp: sub.subscriber?.phone || "-",
                jenis_paket: sub.paketLangganan?.nama_paket || "-",
                harga: sub.paketLangganan?.harga || 0,
                status: sub.status || "pending",
                tanggal_beli: sub.tanggal_mulai ? new Date(sub.tanggal_mulai).toLocaleDateString('id-ID') : "-",
                tanggal_berakhir: sub.tanggal_selesai ? new Date(sub.tanggal_selesai).toLocaleDateString('id-ID') : "-"
            }));

            return res.json({
                role: 'Admin',
                stats: {
                    totalSub, totalPaket, totalEvent, totalSoal, approvedSoal, pendingSoal, activeSub,
                    income: income._sum.amount || 0
                },
                recentSubs
            });
        }

        // ==========================================
        // 2. VALIDATOR DASHBOARD (Dengan Filter Kompetensi!)
        // ==========================================
        if (role === 'Validator') {
            // 1. Ambil keahlian (Kompetensi) si Validator ini dari database
            const kompetensi = await prisma.kompetensiUser.findMany({
                where: { id_user: userIdInt },
                select: { id_subject: true }
            });
            const subjectIds = kompetensi.map(k => k.id_subject);

            const [totalPaketCreated, totalVerified, totalRejected, pendingValidation] = await Promise.all([
                prisma.paketSoal.count({ where: { id_creator: userIdInt, tanggal_dibuat: { gte: oneMonthAgo } } }),
                prisma.validasiSoal.count({ where: { id_validator: userIdInt, status: 'disetujui', tanggal_validasi: { gte: oneMonthAgo } } }),
                prisma.validasiSoal.count({ where: { id_validator: userIdInt, status: 'ditolak', tanggal_validasi: { gte: oneMonthAgo } } }),
                
                // 2. Hitung jumlah soal 'need_verification' HANYA pada Subject yang ia kuasai!
                prisma.soal.count({
                    where: {
                        status: 'need_verification',
                        tanggal_pembuatan: { gte: oneMonthAgoISO },
                        topic: { id_subjects: { in: subjectIds } } // Kunci Filter Sesuai Keahlian
                    }
                })
            ]);

            return res.json({
                role: 'Validator',
                stats: { totalPaketCreated, totalVerified, totalRejected, pendingValidation }
            });
        }

        // ==========================================
        // 3. CONTRIBUTOR DASHBOARD (Hanya Miliknya Sendiri)
        // ==========================================
        if (role === 'Contributor') {
            const [myTotalSoal, myApprovedSoal, myPendingSoal, myUsedSoal, subjectsData] = await Promise.all([
                prisma.soal.count({ where: { id_contributor: userIdInt, tanggal_pembuatan: { gte: oneMonthAgoISO } } }),
                prisma.soal.count({ where: { id_contributor: userIdInt, status: 'disetujui', tanggal_pembuatan: { gte: oneMonthAgoISO } } }),
                prisma.soal.count({ where: { id_contributor: userIdInt, status: 'need_verification', tanggal_pembuatan: { gte: oneMonthAgoISO } } }),
                prisma.soalPaketSoal.count({ where: { soal: { id_contributor: userIdInt } } }), 
                
                // Chart: Hitung soal yang dia buat per mapel dengan relasi yang benar (subjects -> topics -> soal)
                prisma.subjects.findMany({
                    select: {
                        nama_subject: true,
                        topics: {
                            select: {
                                _count: { select: { soal: { where: { id_contributor: userIdInt, tanggal_pembuatan: { gte: oneMonthAgoISO } } } } }
                            }
                        }
                    }
                })
            ]);

            // Format Chart Data & Cegah nilai string yang menyebabkan NaN error di frontend
            const chartDataRaw = subjectsData.map(s => ({
                label: s.nama_subject,
                value: s.topics.reduce((acc, curr) => acc + curr._count.soal, 0)
            })).filter(item => item.value > 0);

            // Kirim minimal array kosong jika tidak ada data
            const chartData = chartDataRaw.length > 0 ? chartDataRaw : [];

            return res.json({
                role: 'Contributor',
                stats: { myTotalSoal, myApprovedSoal, myPendingSoal, myUsedSoal },
                chartData
            });
        }

        return res.status(403).json({ message: "Role tidak diizinkan." });

    } catch (error) {
        console.error("ERROR DASHBOARD STATS:", error);
        res.status(500).json({ message: "Gagal memuat data dashboard", error: error.message });
    }
};

module.exports = { getDashboardStats };