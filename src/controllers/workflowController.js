const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const formatTimeAgo = (date) => {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) return "Baru saja";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} menit lalu`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} jam lalu`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} hari lalu`;
};

const safeString = (str, maxLength = 500) => {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "...";
};

// =================================================================
// 1. PENGAJUAN SOAL (Contributor -> Validator Mapel & Admin)
// =================================================================
const submitSoalWithNotif = async (req, res) => {
  try {
    const { id_soal } = req.body;
    const senderId = req.user.id || req.user.id_user; 

    const updatedSoal = await prisma.soal.update({
      where: { id_soal: parseInt(id_soal) },
      data: { status: 'need_verification' },
      include: { topic: { include: { subject: true } } }
    });

    const subjectId = updatedSoal.topic.id_subjects;
    const subjectName = updatedSoal.topic.subject.nama_subject;
    const senderData = await prisma.users.findUnique({ where: { id_user: senderId } });
    const senderName = senderData.nama_user;

    const globalAdmins = await prisma.users.findMany({ where: { role: 'Admin' } });
    const expertValidators = await prisma.kompetensiUser.findMany({
      where: { id_subject: subjectId },
      include: { user: true }
    });

    const recipientIds = new Set();
    globalAdmins.forEach(admin => recipientIds.add(admin.id_user));
    expertValidators.forEach(comp => {
      if (comp.user.role === 'Validator') recipientIds.add(comp.id_user);
    });

    const notificationData = Array.from(recipientIds).map(recipientId => ({
      id_recipient: recipientId,
      id_sender: senderId,
      id_soal: parseInt(id_soal),
      title: "Pengajuan Soal Baru",
      message: `Contributor ${senderName} telah mengajukan soal baru untuk mata pelajaran ${subjectName}. Menunggu validasi Anda.`,
      is_read: false
    }));

    if (notificationData.length > 0) {
      await prisma.systemNotification.createMany({ data: notificationData });
    }

    return res.status(200).json({ message: "Soal berhasil diajukan, notifikasi dikirim." });

  } catch (error) {
    console.error("Error submit soal:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

// =================================================================
// 2A. TOLAK SOAL (Validator/Admin -> Contributor Asli)
// =================================================================
const rejectSoalWithNotif = async (req, res) => {
  try {
    const { id_soal, catatan_revisi } = req.body;
    const senderId = req.user.id || req.user.id_user; 

    const updatedSoal = await prisma.soal.update({
      where: { id_soal: parseInt(id_soal) },
      data: { status: 'ditolak', catatan_revisi: catatan_revisi },
      include: {
        topic: { include: { subject: true } },
        contributor: true
      }
    });

    const senderData = await prisma.users.findUnique({ where: { id_user: senderId } });
    const senderName = senderData.nama_user;
    const subjectName = updatedSoal.topic.subject.nama_subject;
    const contributorId = updatedSoal.contributor.id_user; 

    await prisma.systemNotification.create({
      data: {
        id_recipient: contributorId,
        id_sender: senderId,
        id_soal: parseInt(id_soal),
        title: "Pengajuan Soal Ditolak",
        message: safeString(`Maaf, soal ${subjectName} Anda dikembalikan oleh ${senderName}. Catatan: ${catatan_revisi}`),
        is_read: false
      }
    });

    return res.status(200).json({ message: "Soal ditolak, notifikasi revisi dikirim." });

  } catch (error) {
    console.error("Error reject soal:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

// =================================================================
// 2B. SETUJUI SOAL (Validator/Admin -> Contributor Asli)
// =================================================================
const approveSoalWithNotif = async (req, res) => {
  try {
    const { id_soal } = req.body;
    const senderId = req.user.id || req.user.id_user;

    const updatedSoal = await prisma.soal.update({
      where: { id_soal: parseInt(id_soal) },
      data: { status: 'disetujui' },
      include: {
        topic: { include: { subject: true } },
        contributor: true
      }
    });

    const senderData = await prisma.users.findUnique({ where: { id_user: senderId } });
    const senderName = senderData.nama_user;
    const subjectName = updatedSoal.topic.subject.nama_subject;
    const contributorId = updatedSoal.contributor.id_user; 

    await prisma.systemNotification.create({
      data: {
        id_recipient: contributorId,
        id_sender: senderId,
        id_soal: parseInt(id_soal),
        title: "Soal Disetujui",
        message: `Selamat! Soal ${subjectName} Anda telah disetujui oleh ${senderName}.`,
        is_read: false
      }
    });

    return res.status(200).json({ message: "Soal disetujui, notifikasi dikirim." });

  } catch (error) {
    console.error("Error approve soal:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

// =================================================================
// 3. AMBIL NOTIFIKASI
// =================================================================
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id || req.user.id_user;
    const rawData = await prisma.systemNotification.findMany({
      where: { id_recipient: userId },
      orderBy: { created_at: 'desc' },
      take: 20 
    });

    const unreadCount = await prisma.systemNotification.count({
      where: { id_recipient: userId, is_read: false }
    });

    const formattedData = rawData.map(item => ({
      id: item.id_notification,       
      title: item.title,              
      message: item.message,          
      time: formatTimeAgo(item.created_at), 
      read: item.is_read,
      related_id: item.id_soal,
      id_event: item.id_event
    }));

    return res.status(200).json({
      notifications: formattedData,
      unreadCount: unreadCount
    });
  } catch (error) {
    console.error("Error fetch notif:", error);
    return res.status(500).json({ message: "Gagal ambil notifikasi" });
  }
};

// =================================================================
// 4. TANDAI SEMUA DIBACA
// =================================================================
const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id || req.user.id_user;
    await prisma.systemNotification.updateMany({
      where: { id_recipient: userId, is_read: false },
      data: { is_read: true }
    });
    return res.status(200).json({ message: "Notifikasi ditandai dibaca" });
  } catch (error) {
    return res.status(500).json({ message: "Gagal update status" });
  }
};

// =================================================================
// 5. HELPER NOTIFIKASI EVENT (Sistem -> Contributor)
// =================================================================
const notifyContributorsForEvent = async (id_event, nama_event, paketIdsArray) => {
  try {
    if (!paketIdsArray || paketIdsArray.length === 0) return;

    const soalDiPaket = await prisma.soalPaketSoal.findMany({
      where: { id_paket_soal: { in: paketIdsArray.map(id => parseInt(id)) } },
      include: {
        soal: { include: { contributor: true } }
      }
    });

    const contributorIds = new Set();
    soalDiPaket.forEach(item => {
      if (item.soal && item.soal.contributor && item.soal.contributor.id_user) {
        contributorIds.add(item.soal.contributor.id_user);
      }
    });

    const notifData = Array.from(contributorIds).map(id => ({
      id_recipient: id,
      id_sender: null,
      id_event: parseInt(id_event),
      title: "Soal Digunakan di Event",
      message: `Selamat! Soal buatan Anda digunakan dalam Event: "${nama_event}".`,
      is_read: false
    }));

    if (notifData.length > 0) {
      await prisma.systemNotification.createMany({
        data: notifData,
        skipDuplicates: true
      });
    }
  } catch (error) {
    console.error("Gagal mengirim notif event:", error);
  }
};

// =================================================================
// 6. TANDAI SATU NOTIFIKASI DIBACA (SAAT DIKLIK)
// =================================================================
const markSingleAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user.id_user;
    
    await prisma.systemNotification.updateMany({
      where: { 
        id_notification: parseInt(id),
        id_recipient: userId 
      },
      data: { is_read: true }
    });
    
    return res.status(200).json({ message: "Notifikasi ditandai dibaca" });
  } catch (error) {
    return res.status(500).json({ message: "Gagal update status" });
  }
};
// =================================================================
// 7. HAPUS SEMUA NOTIFIKASI USER (HANYA MILIK USER YANG LOGIN)
// =================================================================
const deleteAllMyNotifications = async (req, res) => {
  try {
    // Ambil ID user yang sedang login
    const userId = req.user?.id || req.user?.id_user;
    
    // Hapus SEMUA notifikasi (baik terbaca maupun belum) HANYA untuk user ini
    await prisma.systemNotification.deleteMany({
      where: { 
        id_recipient: parseInt(userId) 
      }
    });
    
    return res.status(200).json({ message: "Semua notifikasi berhasil dihapus" });
  } catch (error) {
    console.error("Error delete notifications:", error);
    return res.status(500).json({ message: "Gagal menghapus notifikasi" });
  }
};

module.exports = {
  submitSoalWithNotif,
  rejectSoalWithNotif,
  approveSoalWithNotif,
  getUserNotifications,
  markAsRead,
  notifyContributorsForEvent,
  markSingleAsRead,
  deleteAllMyNotifications
};