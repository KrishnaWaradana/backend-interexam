const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getDashboardStats = async (req, res) => {
  try {
    const { id_user, role } = req.user;

    // --- LOGIKA UNTUK ADMIN ---
    if (role === 'Admin') {
      const [totalSub, totalPaket, totalEvent, totalSoal, approvedSoal, activeSub, income, recentSubs] = await Promise.all([
        prisma.subscribers.count(),
        prisma.paketSoal.count(),
        prisma.event.count(),
        prisma.soal.count(),
        prisma.soal.count({ where: { status: 'disetujui' } }),
        prisma.subscribePaket.count({ where: { status: 'active' } }),
        prisma.transaksi.aggregate({
          _sum: { amount: true },
          where: { status: 'settlement' } // atau 'success'
        }),
        prisma.subscribers.findMany({ take: 5, orderBy: { id_subscriber: 'desc' } })
      ]);

      return res.json({
        role: 'Admin',
        stats: {
          totalSub, totalPaket, totalEvent, totalSoal, approvedSoal, activeSub,
          income: income._sum.amount || 0
        },
        recentSubs
      });
    }

    // --- LOGIKA UNTUK VALIDATOR ---
    if (role === 'Validator') {
      const [totalVerified, pendingValidation, totalRejected] = await Promise.all([
        prisma.validasiSoal.count({ where: { id_validator: id_user, status: 'disetujui' } }),
        prisma.soal.count({ where: { status: 'need_verification' } }),
        prisma.validasiSoal.count({ where: { id_validator: id_user, status: 'ditolak' } })
      ]);

      return res.json({
        role: 'Validator',
        stats: { totalVerified, pendingValidation, totalRejected }
      });
    }

    // --- LOGIKA UNTUK CONTRIBUTOR ---
    if (role === 'Contributor') {
      const [myTotalSoal, myApprovedSoal, chartRaw] = await Promise.all([
        prisma.soal.count({ where: { id_contributor: id_user } }),
        prisma.soal.count({ where: { id_contributor: id_user, status: 'disetujui' } }),
        // Untuk SimpleBarChart: Jumlah soal per Subject
        prisma.subjects.findMany({
          select: {
            nama_subject: true,
            _count: { select: { soal: { where: { id_contributor: id_user } } } }
          }
        })
      ]);

      return res.json({
        role: 'Contributor',
        stats: { myTotalSoal, myApprovedSoal },
        chartData: chartRaw.map(item => ({
          label: item.nama_subject,
          value: item._count.soal
        }))
      });
    }

  } catch (error) {
    res.status(500).json({ message: "Gagal memuat data dashboard", error: error.message });
  }
};

module.exports = { getDashboardStats };