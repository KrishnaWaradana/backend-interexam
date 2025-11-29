// apps/backend/src/controllers/authController.js

const { OAuth2Client } = require('google-auth-library');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
  const { token } = req.body;

  try {
    // 1. Verifikasi Token ke Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    // Ambil data dari Google
    // Google ngasih: email, name, sub (id unik), picture
    const { email, name, sub } = ticket.getPayload(); 

    // 2. Cek atau Buat User di Database
    // Kita pakai 'email_user' sebagai patokan
    let user = await prisma.users.upsert({
      where: { 
        email_user: email
      },
      update: { 
        googleId: sub,
        nama_user: name 
      },
      create: {
        email_user: email,
        nama_user: name,
        googleId: sub,
        username: email.split('@')[0],
        role: 'USER' // Sesuaikan dengan enum Role kamu kalau ada default
      },
    });

    const jwtToken = jwt.sign(
      { 
        id_user: user.id_user,
        email: user.email_user,
        role: user.role 
      }, 
      'RAHASIA_KITA',
      { expiresIn: '1d' }
    );

    res.status(200).json({ 
      message: "Login Berhasil", 
      token: jwtToken, 
      user: { 
        id: user.id_user,
        nama: user.nama_user, 
        email: user.email_user,
        role: user.role
      } 
    });

  } catch (error) {
    console.error("Google Login Error:", error);
    res.status(400).json({ message: "Google Login Gagal", error: error.message });
  }
};