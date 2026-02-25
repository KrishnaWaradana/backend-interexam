const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcryptjs");

// --- API 1: AMBIL DATA PROFIL ---
exports.getProfile = async (req, res) => {
  try {
    const id_subscriber = parseInt(req.user.id);

    const user = await prisma.subscribers.findUnique({
      where: { id_subscriber: id_subscriber },
      select: {
        id_subscriber: true,
        nama_subscriber: true,
        email_subscriber: true,
        phone: true,
        foto: true,
      },
    });

    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User tidak ditemukan" });
    }

    res.status(200).json({ status: "success", data: user });
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// --- API 2: UPDATE DATA PROFIL & FOTO ---
exports.updateProfile = async (req, res) => {
  try {
    const id_subscriber = parseInt(req.user.id);
    const { nama_subscriber } = req.body;

    let updateData = {};

    if (nama_subscriber) {
      updateData.nama_subscriber = nama_subscriber;
      updateData.username = nama_subscriber;
    }

    // Jika ada file foto yang di-upload lewat multer
    if (req.file) {
      // Masuk ke folder default sesuai settingan Multer temanmu
      updateData.foto = `/uploads/photos/${req.file.filename}`;
    }

    const updatedUser = await prisma.subscribers.update({
      where: { id_subscriber: id_subscriber },
      data: updateData,
      select: {
        id_subscriber: true,
        nama_subscriber: true,
        email_subscriber: true,
        phone: true,
        foto: true,
      },
    });

    res.status(200).json({
      status: "success",
      message: "Profil berhasil diperbarui",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// --- API 3: UPDATE EMAIL ---
exports.updateEmail = async (req, res) => {
  try {
    const id_subscriber = parseInt(req.user.id);
    const { newEmail, password } = req.body;

    // Validasi input
    if (!newEmail || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email dan password harus diisi",
      });
    }

    // Cek user ada atau tidak
    const user = await prisma.subscribers.findUnique({
      where: { id_subscriber: id_subscriber },
    });

    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User tidak ditemukan" });
    }

    // Verifikasi password lama
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: "error",
        message: "Password lama salah",
      });
    }

    // Cek email sudah digunakan atau belum
    const emailExists = await prisma.subscribers.findFirst({
      where: {
        email_subscriber: newEmail,
        NOT: { id_subscriber: id_subscriber },
      },
    });

    if (emailExists) {
      return res.status(400).json({
        status: "error",
        message: "Email sudah digunakan oleh user lain",
      });
    }

    // Update email
    const updatedUser = await prisma.subscribers.update({
      where: { id_subscriber: id_subscriber },
      data: { email_subscriber: newEmail },
      select: {
        id_subscriber: true,
        nama_subscriber: true,
        email_subscriber: true,
        phone: true,
      },
    });

    res.status(200).json({
      status: "success",
      message: "Email berhasil diperbarui",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update Email Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// --- API 4: UPDATE PHONE ---
exports.updatePhone = async (req, res) => {
  try {
    const id_subscriber = parseInt(req.user.id);
    const { newPhone } = req.body;

    // Validasi input
    if (!newPhone) {
      return res.status(400).json({
        status: "error",
        message: "Nomor telepon harus diisi",
      });
    }

    // Cek user
    const user = await prisma.subscribers.findUnique({
      where: { id_subscriber: id_subscriber },
    });

    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User tidak ditemukan" });
    }

    // Update phone
    const updatedUser = await prisma.subscribers.update({
      where: { id_subscriber: id_subscriber },
      data: { phone: newPhone },
      select: {
        id_subscriber: true,
        nama_subscriber: true,
        email_subscriber: true,
        phone: true,
      },
    });

    res.status(200).json({
      status: "success",
      message: "Nomor telepon berhasil diperbarui",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update Phone Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// --- API 5: CHANGE PASSWORD ---
exports.changePassword = async (req, res) => {
  try {
    const id_subscriber = parseInt(req.user.id);
    const { oldPassword, newPassword, confirmPassword } = req.body;

    // Validasi input
    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        status: "error",
        message: "Semua field password harus diisi",
      });
    }

    // Cek password konfirmasi sama dengan password baru
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        status: "error",
        message: "Password baru dan konfirmasi tidak sesuai",
      });
    }

    // Cek password baru minimal 6 karakter
    if (newPassword.length < 6) {
      return res.status(400).json({
        status: "error",
        message: "Password baru minimal 6 karakter",
      });
    }

    // Cek user
    const user = await prisma.subscribers.findUnique({
      where: { id_subscriber: id_subscriber },
    });

    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User tidak ditemukan" });
    }

    // Verifikasi password lama
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: "error",
        message: "Password lama salah",
      });
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.subscribers.update({
      where: { id_subscriber: id_subscriber },
      data: { password: hashedPassword },
    });

    res.status(200).json({
      status: "success",
      message: "Password berhasil diperbarui",
    });
  } catch (error) {
    console.error("Change Password Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};
