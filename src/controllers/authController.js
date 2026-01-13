const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { verifyGoogleToken } = require('../utils/googleAuth');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

// ==========================================
// 1. FUNGSI LOGIN GOOGLE
// ==========================================
exports.googleLogin = async (req, res) => {
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

    // ------------------------------------------
    // LOGIC A: SUBSCRIBER (Siswa/User Umum)
    // ------------------------------------------
    if (roleTarget === 'subscriber') {
      
      // Cross VALIDASI 1: Cek di tabel Users (Internal) dulu
      // Mencegah akun Staff login/daftar sebagai Siswa
      const isInternal = await prisma.users.findFirst({
        where: { email_user: email }
      });

      if (isInternal) {
        return res.status(400).json({ 
          message: "Email ini terdaftar sebagai Staff/Admin. Gunakan menu login Contributor/Validator." 
        });
      }

      // --- Lanjut Logic Subscriber ---
      
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
            googleId: googleId,
            foto: picture 
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
    
    // ------------------------------------------
    // LOGIC B: INTERNAL (Admin/Validator/Contributor)
    // ------------------------------------------
    else {

      // Cross VALIDASI 2: Cek di tabel Subscribers (Siswa) dulu
      // Mencegah akun Siswa login/daftar sebagai Staff
      const isSubscriber = await prisma.subscribers.findFirst({
        where: { email_subscriber: email }
      });

      if (isSubscriber) {
        return res.status(400).json({ 
          message: "Email ini terdaftar sebagai Siswa. Gunakan menu login Siswa." 
        });
      }

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

        // Buat User Baru (Status Unverified) & Catat History
        await prisma.$transaction(async (tx) => {
          const newUser = await tx.users.create({
            data: {
              email_user: email,
              nama_user: name,
              googleId: googleId,
              role: requestRole,
              foto: picture,
              status: 'Unverified'
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
      
      // Cek Status (Snapshot)
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

    // 3. Buat JWT Token
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
    console.error("Google Login Error:", error);
    return res.status(401).json({ message: "Auth failed", error: error.message });
  }
};

// ==========================================
// 2. FUNGSI SESSION PERSISTENCE (GET ME)
// ==========================================
exports.getMe = async (req, res) => {
  try {
    const { id, role } = req.user; 

    let user = null;

    if (role === 'subscriber') {
      user = await prisma.subscribers.findUnique({
        where: { id_subscriber: id },
        select: {
          id_subscriber: true,
          nama_subscriber: true,
          email_subscriber: true,
          foto: true,
        }
      });
      
      if (user) {
        user.role = 'subscriber';
        user.nama = user.nama_subscriber; 
        user.id = user.id_subscriber;     
      }

    } else {
      user = await prisma.users.findUnique({
        where: { id_user: id },
        select: {
          id_user: true,
          nama_user: true,
          email_user: true,
          role: true,
          foto: true,
          status: true
        }
      });

      if (user) {
        user.nama = user.nama_user;
        user.id = user.id_user;
      }
    }

    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan / Token kedaluwarsa." });
    }

    res.status(200).json({ 
      message: "Session valid", 
      user: user 
    });

  } catch (error) {
    console.error("Error getMe:", error);
    res.status(500).json({ message: "Gagal memuat sesi user." });
  }
};

exports.logout = async (req, res) => {
     res.status(200).json({ 
        message: "Logout berhasil. Silakan hapus token di Client side." 
    });
};