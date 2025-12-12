    // apps/backend/src/controllers/userController.js

    const bcrypt = require('bcryptjs');
    const prisma = require('../config/prismaClient');
    const fs = require('fs'); // Import file system module
    const path = require('path');

    const allowedRoles = ['Admin', 'Validator', 'Contributor'];

    // --- HELPER: Function to delete file ---
    const deleteFile = (filePath) => {
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (err) {
                console.error("Failed to delete file:", err);
            }
        }
    };

    exports.getAllowedRoles = (req, res) => {
        res.status(200).json({ data: allowedRoles });
    };

    exports.getAllSubjects = async (req, res) => {
        try {
            const subjects = await prisma.subjects.findMany({
                select: {
                    id_subject: true,
                    nama_subject: true
                },
                orderBy: { nama_subject: 'asc' }
            });

            res.status(200).json({
                message: 'Daftar subjek/keahlian berhasil diambil.',
                data: subjects
            });

        } catch (error) {
            console.error('Prisma/Database Error saat GET Subjects:', error);
            res.status(500).json({ message: 'Gagal mengambil daftar subjek.' });
        }
    };

    // --- 1. CRUD CREATE (addUser) ---

    exports.addUser = async (req, res) => {
        const { username, email_user, password, role, nama_user, phone, subject_ids } = req.body;
        
        // Logika Foto: Jika ada file, pakai path-nya. Jika tidak, NULL.
        // (Kita tidak simpan path default di database, cukup null saja agar hemat storage)
        const fotoPath = req.file ? req.file.path : null;

        try {
            // 1. VALIDASI FORM LENGKAP (WAJIB DIISI)
            // Cek apakah field penting terisi?
            if (!username || !email_user || !password || !role || !phone || !nama_user) {
                // Hapus foto jika terlanjur ter-upload agar tidak jadi sampah
                if (fotoPath) deleteFile(fotoPath);
                return res.status(400).json({ message: "Harap isi form dengan lengkap (Nama, Username/Email, Password, Jabatan, No HP)." });
            }

            // 2. VALIDASI DUPLIKAT
            const existingUser = await prisma.users.findFirst({
                where: {
                    OR: [
                        { email_user: email_user },
                        { username: username },
                        { phone: phone }
                    ]
                }
            });

            if (existingUser) {
                if (fotoPath) deleteFile(fotoPath);

                let msg = 'User sudah terdaftar.';
                if (existingUser.email_user === email_user) msg = 'Email sudah digunakan.';
                else if (existingUser.username === username) msg = 'Username sudah digunakan.';
                else if (existingUser.phone === phone) msg = 'Nomor telepon sudah digunakan.';

                return res.status(409).json({ message: msg });
            }

            // 3. HASH PASSWORD
            const hashedPassword = await bcrypt.hash(password, 10);

            // 4. DATA KEAHLIAN (RELASI)
            let kompetensiData = undefined;
            if (subject_ids) {
                const idsArray = Array.isArray(subject_ids) ? subject_ids : [subject_ids];
                kompetensiData = {
                    create: idsArray.map(id => ({ id_subject: parseInt(id) }))
                };
            }

            // 5. SIMPAN KE DATABASE
            const newUser = await prisma.users.create({
                data: {
                    username,
                    email_user,
                    nama_user,
                    password: hashedPassword,
                    role,
                    phone,
                    foto: fotoPath, // Bisa null (artinya pakai default nanti di frontend)
                    kompetensi: kompetensiData
                }
            });

            res.status(201).json({ message: 'User berhasil ditambahkan.', data: { id_user: newUser.id_user } });

        } catch (error) {
            if (fotoPath) deleteFile(fotoPath);
            console.error('Prisma Error saat CREATE:', error);
            res.status(500).json({ message: 'Gagal memproses data di server.', error: error.message });
        }
    };

    // --- 2. CRUD READ (getAllUsers) ---
    exports.getAllUsers = async (req, res) => {
        try {
            const usersData = await prisma.users.findMany({
                select: {
                    id_user: true, username: true, email_user: true, nama_user: true,
                    role: true, phone: true, foto: true
                },
                orderBy: { id_user: 'asc' }
            });

            res.status(200).json({ message: 'Daftar user berhasil diambil.', data: usersData });

        } catch (error) {
            console.error('Prisma/Database Error saat READ:', error);
            res.status(500).json({ message: 'Gagal mengambil data user dari server.' });
        }
    };
    exports.getUserById = async (req, res) => {
        const userId = parseInt(req.params.id);
        try {
            // Ambil satu user berdasarkan ID
            const user = await prisma.users.findUnique({
                where: { id_user: userId },
                include: {
                    kompetensi: true // Penting: Ambil juga data keahliannya
                }
            });

            if (!user) {
                return res.status(404).json({ message: `User dengan ID ${userId} tidak ditemukan.` });
            }

            // Format data agar frontend lebih mudah membacanya (terutama subject_ids)
            const formattedUser = {
                ...user,
                subject_ids: user.kompetensi.map(k => k.id_subject) // Ambil ID-nya saja jadi array [1, 2]
            };

            res.status(200).json({ 
                message: 'Data user ditemukan.', 
                data: formattedUser 
            });

        } catch (error) {
            console.error('Prisma Error saat GET User By ID:', error);
            res.status(500).json({ message: 'Gagal mengambil data user.' });
        }
    };
    // --- 3. CRUD UPDATE (updateUser) ---
    exports.updateUser = async (req, res) => {
        const userId = parseInt(req.params.id);
        // Ambil SEMUA data, termasuk password, foto, dan subject_ids
        const { username, email_user, nama_user, role, phone, subject_ids, password } = req.body;
        
        // Check if new file uploaded
        const newFotoPath = req.file ? req.file.path : null;

        try {
            // 1. Validasi Dasar & Cek Keberadaan User
            if (role && !allowedRoles.includes(role)) {
                if (newFotoPath) deleteFile(newFotoPath);
                return res.status(400).json({ message: `Nilai role '${role}' tidak valid.` });
            }

            const existingUser = await prisma.users.findUnique({ where: { id_user: userId } });
            if (!existingUser) { 
                if (newFotoPath) deleteFile(newFotoPath);
                return res.status(404).json({ message: `User dengan ID ${userId} tidak ditemukan.` }); 
            }

            // Cek Email Unik (Jika email diubah)
            if (email_user && email_user !== existingUser.email_user) {
                const emailCheck = await prisma.users.findFirst({ where: { email_user } });
                if (emailCheck) { 
                    if (newFotoPath) deleteFile(newFotoPath);
                    return res.status(409).json({ message: 'Email baru sudah digunakan.' }); 
                }
            }

            // 2. Siapkan Objek Data untuk Update
            const updateData = {};

            if (username) updateData.username = username;
            if (nama_user) updateData.nama_user = nama_user;
            if (role) updateData.role = role;
            if (phone) updateData.phone = phone;
            if (email_user) updateData.email_user = email_user;
            
            // Update Foto Logic
            if (newFotoPath) {
                updateData.foto = newFotoPath;
                // Hapus foto lama jika ada
                if (existingUser.foto) deleteFile(existingUser.foto);
            }

            // 3. Penanganan Password (Wajib Hashing)
            if (password) {
                const hashedPassword = await bcrypt.hash(password, 10);
                updateData.password = hashedPassword;
            }

            // 4. Update Relasi Keahlian (DELETE-CREATE pattern)
            if (subject_ids !== undefined) {
                // HAPUS semua relasi kompetensi yang lama
                await prisma.kompetensiUser.deleteMany({ where: { id_user: userId } });

                // Buat objek data relasi baru
                const idsArray = Array.isArray(subject_ids) ? subject_ids : [subject_ids];
                const newCompetencies = idsArray.map(id => ({ id_subject: parseInt(id) }));

                updateData.kompetensi = { create: newCompetencies };
            }

            // 6. Final Update
            const updatedUser = await prisma.users.update({
                where: { id_user: userId },
                data: updateData,
                select: { id_user: true, nama_user: true, email_user: true, role: true, foto: true }
            });

            res.status(200).json({ message: `Data user '${updatedUser.nama_user}' berhasil diperbarui.`, data: updatedUser });

        } catch (error) {
            if (newFotoPath) deleteFile(newFotoPath);
            console.error('Prisma/Database Error saat UPDATE:', error);
            res.status(500).json({ message: 'Gagal memperbarui data user.', error: error.message });
        }
    };

    // --- 4. CRUD DELETE (deleteUser) ---
    exports.deleteUser = async (req, res) => {
        const userId = parseInt(req.params.id);

        try {
            const userToDelete = await prisma.users.findUnique({ where: { id_user: userId } });
            if (!userToDelete) {
                return res.status(404).json({ message: `User dengan ID ${userId} tidak ditemukan.` });
            }

            // 1. Hapus Relasi Many-to-Many (Kompetensi/Keahlian)
            await prisma.kompetensiUser.deleteMany({
                where: { id_user: userId }
            });

            // 2. Hapus Relasi Status (UserStatus)
            await prisma.userStatus.deleteMany({
                where: { OR: [{ id_user: userId }, { id_admin: userId }] }
            });

            // 3. Hapus Relasi Paket Soal yang Dibuat User ini
            await prisma.paketSoal.deleteMany({
                where: { id_creator: userId }
            });

            // 4. Hapus Validasi Soal yang Dibuat User ini (Jika User adalah Validator)
            await prisma.validasiSoal.deleteMany({
                where: { id_validator: userId }
            });
            
            // 5. Hapus Foto Profil dari disk
            if (userToDelete.foto) {
                deleteFile(userToDelete.foto);
            }

            // 6. Hapus User Utama
            await prisma.users.delete({ where: { id_user: userId } });

            res.status(200).json({ message: `User '${userToDelete.nama_user}' berhasil dihapus secara total.`, deletedUserId: userId });

        } catch (error) {
            console.error('Prisma/Database Error saat DELETE:', error);
            res.status(500).json({ message: 'Gagal menghapus user.', error: error.message });
        }
    };
    exports.getCompetencies = async (req, res) => {
    
        // ⚠️ PENTING: GANTI INI NANTI
        // Logika Pengambilan ID User:
        // Asumsi: Jika Auth berhasil, ID user ada di req.user.id_user (atau req.auth.id, dsb.)
        // Saat ini, kita ambil user pertama untuk debugging.
        let contributorId;
        try {
            // Logika DEBUG: Ambil ID user Contributor/Validator pertama
            const user = await prisma.users.findFirst({
                where: { role: { in: ['Contributor', 'Validator'] } },
                select: { id_user: true }
            });
            if (!user) {
                // Jika tidak ada user Contributor/Validator, berikan respons kosong/error
                return res.status(404).json({ message: 'Tidak ditemukan user Contributor/Validator di database.' });
            }
            contributorId = user.id_user;
            // const contributorId = req.user.id_user; // ⬅️ UNCOMMENT INI JIKA AUTH TEMAN ANDA SUDAH JADI
        } catch (e) {
            return res.status(500).json({ message: 'Error saat mencari user untuk mendapatkan ID.' });
        }
        
        try {
            const competencies = await prisma.kompetensiUser.findMany({
                where: { id_user: contributorId },
                include: {
                    subject: {
                        select: { id_subject: true, nama_subject: true }
                    }
                }
            });
    
            // Format data menjadi array Subject
            const subjectList = competencies.map(c => c.subject);
    
            res.status(200).json({ 
                message: `Daftar keahlian berhasil diambil untuk user ID ${contributorId}.`,
                data: subjectList 
            });
    
        } catch (error) {
            console.error('Prisma/Database Error saat GET Competencies:', error);
            res.status(500).json({ message: 'Gagal mengambil daftar keahlian.' });
        }
    };

    // ... (kode temanmu yang CRUD Create, Read, Update, Delete di atas biarkan saja) ...

// --- 5. TAMBAHAN: KHUSUS ADMIN UBAH STATUS (Approve/Suspend) ---
exports.changeUserStatus = async (req, res) => {
    const userId = parseInt(req.params.id);
    const { status, reason } = req.body; // status: 'Verified', 'Suspend', 'Unverified'
    
    // Ambil ID Admin dari Token (Diset oleh middleware authenticateToken)
    const adminId = req.user ? req.user.id : null; 

    try {
        // 1. Validasi Input Status
        const validStatuses = ['Verified', 'Unverified', 'Suspend'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ message: "Status tidak valid. Gunakan: Verified, Unverified, atau Suspend." });
        }

        // 2. Transaction: Update User + Catat History di UserStatus
        const result = await prisma.$transaction(async (tx) => {
            // A. Update status User
            const updatedUser = await tx.users.update({
                where: { id_user: userId },
                data: { status: status }
            });

            // B. Catat History
            await tx.userStatus.create({
                data: {
                    id_user: userId,
                    id_admin: adminId,
                    status: status,
                    description: reason || `Status diubah menjadi ${status} oleh Admin`
                }
            });

            return updatedUser;
        });

        res.status(200).json({ 
            message: `Berhasil mengubah status user menjadi ${status}.`, 
            data: result 
        });

    } catch (error) {
        console.error('Error changeStatus:', error);
        res.status(500).json({ message: 'Gagal mengubah status user.', error: error.message });
    }
};