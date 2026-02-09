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
// 1. LOGIC PENGAJUAN SOAL (Contributor -> Validator Mapel & Admin)
// =================================================================
const submitSoalWithNotif = async (req, res) => {
  try {
    const { id_soal } = req.body;
    const senderId = req.user.id_user; 

    const updatedSoal = await prisma.soal.update({
      where: { id_soal: parseInt(id_soal) },
      data: { status: 'need_verification' }, 
      include: {
        topic: { include: { subject: true } },
        contributor: true
      }
    });

    const subjectId = updatedSoal.topic.subject.id_subject;
    const subjectName = updatedSoal.topic.subject.nama_subject;
    const senderName = updatedSoal.contributor.nama_user;

    // B. LOGIC PENERIMA NOTIFIKASI
    const admins = await prisma.users.findMany({
      where: { role: 'Admin' },
      select: { id_user: true }
    });
    const specializedValidators = await prisma.kompetensiUser.findMany({
      where: { id_subject: subjectId },
      include: { user: true }
    });
    const recipientIds = new Set();
    admins.forEach(a => recipientIds.add(a.id_user));
    specializedValidators.forEach(v => {
      if (v.user.role === 'Validator') recipientIds.add(v.user.id_user);
    });

    const notificationData = Array.from(recipientIds).map(recipientId => ({
      id_recipient: recipientId,
      id_sender: senderId,
      title: "Pengajuan Soal", 
      message: safeString(`${senderName} mengajukan soal mata pelajaran ${subjectName}.`),
      is_read: false,
    }));

    if (notificationData.length > 0) {
      await prisma.systemNotification.createMany({ 
        data: notificationData,
        skipDuplicates: true 
      });
    }

    return res.status(200).json({ message: "Soal diajukan, notifikasi terkirim." });

  } catch (error) {
    console.error("Error submit soal:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

// =================================================================
// 2. LOGIC TOLAK SOAL (Validator/Admin -> Contributor Asli)
// =================================================================
const rejectSoalWithNotif = async (req, res) => {
  try {
    const { id_soal, catatan_revisi } = req.body;
    const senderId = req.user.id_user; 

    // A. Update Status Soal & Catatan
    const updatedSoal = await prisma.soal.update({
      where: { id_soal: parseInt(id_soal) },
      data: { 
        status: 'ditolak',
        catatan_revisi: catatan_revisi
      },
      include: {
        topic: { include: { subject: true } },
        contributor: true
      }
    });

    const senderData = await prisma.users.findUnique({ where: { id_user: senderId } });
    const senderName = senderData.nama_user;
    const subjectName = updatedSoal.topic.subject.nama_subject;
    const contributorId = updatedSoal.contributor.id_user; 

    // B. Kirim Notif Balik ke Contributor
    await prisma.systemNotification.create({
      data: {
        id_recipient: contributorId,
        id_sender: senderId,
        title: "Perlu Revisi",
        message: safeString(`${senderName} menolak soal ${subjectName}. Cek catatan: ${catatan_revisi}`),
        is_read: false
      }
    });

    return res.status(200).json({ message: "Soal ditolak, notifikasi dikirim." });

  } catch (error) {
    console.error("Error reject soal:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

// =================================================================
// 3. LOGIC AMBIL DATA (GET) 
// =================================================================
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id_user;

    const rawData = await prisma.systemNotification.findMany({
      where: { id_recipient: userId },
      orderBy: { created_at: 'desc' },
      take: 20 // Limit 20 terakhir
    });

    const unreadCount = await prisma.systemNotification.count({
      where: { id_recipient: userId, is_read: false }
    });

    const formattedData = rawData.map(item => ({
      id: item.id_notification,       
      title: item.title,              
      message: item.message,          
      time: formatTimeAgo(item.created_at), 
      read: item.is_read              
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
// 4. LOGIC TANDAI DIBACA
// =================================================================
const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id_user;
    await prisma.systemNotification.updateMany({
      where: { id_recipient: userId, is_read: false },
      data: { is_read: true }
    });
    return res.status(200).json({ message: "Success" });
  } catch (error) {
    return res.status(500).json({ message: "Error" });
  }
};

module.exports = { 
  submitSoalWithNotif, 
  rejectSoalWithNotif, 
  getUserNotifications, 
  markAsRead 
};