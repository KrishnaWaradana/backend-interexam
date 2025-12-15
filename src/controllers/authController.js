const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { verifyGoogleToken } = require('../utils/googleAuth');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

const googleLogin = async (req, res) => {
  // roleTarget: 'subscriber' atau 'internal'
  // requestRole: 'Validator' atau 'Contributor' (hanya jika register internal)
  const { token, roleTarget, requestRole } = req.body; 

  if (!token) return res.status(400).json({ message: "Token is required" });

  try {
    // 1. Verifikasi ke Google
    const googlePayload = await verifyGoogleToken(token);
    const { googleId, email, name, picture } = googlePayload;

    let user = null;
    let userRole = '';
    let dbPayload = {}; 

    // ==========================================
    // LOGIC A: SUBSCRIBER (Siswa/User Umum)
    // ==========================================
    if (roleTarget === 'subscriber') {
      // Cek apakah subscriber sudah ada?
      user = await prisma.subscribers.findFirst({
        where: { OR: [{ googleId: googleId }, { email_subscriber: email }] }
      });

      // Jika belum ada, Auto Register
      if (!user) {
        user = await prisma.subscribers.create({
          data: {
            email_subscriber: email,
            nama_subscriber: name,
            googleId: googleId
            // status tidak dimasukkan karena ikut logika paket langganan
          }
        });
      } else {
        // Jika user lama (belum ada googleId), update
        if (!user.googleId) {
          user = await prisma.subscribers.update({
            where: { id_subscriber: user.id_subscriber },
            data: { googleId: googleId }
          });
        }
      }
      
      userRole = 'subscriber';
      dbPayload = { id: user.id_subscriber, role: 'subscriber' };
    } 
    
    // ==========================================
    // LOGIC B: INTERNAL (Admin/Validator/Contributor)
    // ==========================================
    else {
      // Cek apakah user internal sudah ada?
      user = await prisma.users.findFirst({
        where: { OR: [{ googleId: googleId }, { email_user: email }] }
      });

      // --- Skenario 1: User Belum Ada (Register Baru) ---
      if (!user) {
        if (!requestRole || !['Validator', 'Contributor'].includes(requestRole)) {
           return res.status(400).json({ 
             message: "Pilih role: Validator atau Contributor." 
           });
        }

        // Buat User Baru (Status Unverified)
        // Gunakan Transaction agar User dan History tercatat bersamaan
        await prisma.$transaction(async (tx) => {
          const newUser = await tx.users.create({
            data: {
              email_user: email,
              nama_user: name,
              googleId: googleId,
              role: requestRole,
              status: 'Unverified' // <--- PENTING: Tahan dulu
            }
          });

          // Catat History
          await tx.userStatus.create({
            data: {
              id_user: newUser.id_user,
              status: 'Unverified',
              description: 'Pendaftaran baru via Google',
              created_at: new Date()
            }
          });
        });

        // STOP & INFO KE USER
        return res.status(200).json({
          message: "Pendaftaran berhasil. Akun menunggu persetujuan Admin.",
          status: "pending"
        });
      }

      // --- Skenario 2: User Sudah Ada (Login) ---
      
      // Cek Status di kolom Users (Snapshot) -> Lebih Cepat
      if (user.status === 'Unverified') {
        return res.status(403).json({ 
          message: "Akun belum disetujui Admin. Hubungi admin.",
          status: "pending"
        });
      }

      if (user.status === 'Suspend') { 
        return res.status(403).json({ message: "Akun Anda disuspend." });
      }

      // Update googleId jika belum ada
      if (!user.googleId) {
        await prisma.users.update({
          where: { id_user: user.id_user },
          data: { googleId: googleId }
        });
      }

      userRole = user.role;
      dbPayload = { id: user.id_user, role: user.role };
    }

    // 3. Buat JWT Token (Hanya jika lolos verifikasi)
    const appToken = jwt.sign(dbPayload, JWT_SECRET, { expiresIn: '1d' });

    return res.status(200).json({
      message: "Login success",
      token: appToken,
      user: {
        id: dbPayload.id,
        name: roleTarget === 'subscriber' ? user.nama_subscriber : user.nama_user,
        email: email,
        role: userRole,
        photo: picture
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(401).json({ message: "Auth failed", error: error.message });
  }
};

module.exports = { googleLogin };