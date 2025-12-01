// src/controllers/authController.js
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { verifyGoogleToken } = require('../utils/googleAuth');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'rahasia_super_aman'; // Ganti dengan ENV

const googleLogin = async (req, res) => {
  // Frontend mengirim { token: "...", roleTarget: "subscriber" | "admin" }
  const { token, roleTarget } = req.body; 

  if (!token) return res.status(400).json({ message: "Token is required" });

  try {
    // 1. Verifikasi Token ke Google
    const googlePayload = await verifyGoogleToken(token);
    const { googleId, email, name, picture } = googlePayload;

    let user = null;
    let userRole = '';
    let dbPayload = {}; // Data untuk disimpan di JWT

    // 2. Logic Percabangan: Cek berdasarkan Target Login

    // === KASUS A: LOGIN SEBAGAI SUBSCRIBER ===
    if (roleTarget === 'subscriber') {
      // Cari di tabel Subscribers
      user = await prisma.subscribers.findFirst({
        where: { OR: [{ googleId: googleId }, { email_subscriber: email }] }
      });

      // Jika belum ada, Register otomatis (Auto Sign-up)
      if (!user) {
        user = await prisma.subscribers.create({
          data: {
            email_subscriber: email,
            nama_subscriber: name,
            googleId: googleId,
            status: 'active' // Default status
          }
        });
      } else {
        // Jika user ada tapi belum punya googleId (login lama via email biasa), update googleId
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
    
    // === KASUS B: LOGIN SEBAGAI ADMIN/INTERNAL ===
    else {
      // Cari di tabel Users
      user = await prisma.users.findFirst({
        where: { OR: [{ googleId: googleId }, { email_user: email }] }
      });

      if (!user) {
        // Untuk Admin/Validator, biasanya TIDAK auto-register demi keamanan.
        // User harus dibuat manual dulu di DB oleh Super Admin.
        return res.status(403).json({ message: "Akses ditolak. Email tidak terdaftar sebagai staf." });
      }

      // Update googleId jika belum ada
      if (!user.googleId) {
        user = await prisma.users.update({
          where: { id_user: user.id_user },
          data: { googleId: googleId }
        });
      }

      userRole = user.role; // Admin, Validator, atau Contributor
      dbPayload = { id: user.id_user, role: user.role };
    }

    // 3. Buat JWT Token Aplikasi Kamu
    const appToken = jwt.sign(dbPayload, JWT_SECRET, { expiresIn: '1d' });

    // 4. Kirim Response
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
    return res.status(401).json({ message: "Authentication failed", error: error.message });
  }
};

module.exports = { googleLogin };