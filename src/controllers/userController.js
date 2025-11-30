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