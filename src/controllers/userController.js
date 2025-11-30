// apps/backend/src/controllers/userController.js

const bcrypt = require('bcryptjs'); 
const prisma = require('../config/prismaClient');
const allowedRoles = ['Admin', 'Validator', 'Contributor'];
const fs = require('fs');


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
    // Ambil data dasar dari req.body
    const { username, email_user, password, role, nama_user, phone, subject_ids } = req.body; 
    
    // Ambil path foto dari Multer. Jika ada file, gunakan path-nya. Jika tidak, gunakan null.
    const fotoPath = req.file ? req.file.path : null;
    try {
        // 1. Validasi Input Wajib, Role, dan Email Unik
        // ... (Logika validasi dasar dan check unik tetap sama)

        // 2. HASH PASSWORD
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 3. Siapkan Data Relasi Kompetensi (Nested Writes)
        const kompetensiData = subject_ids && subject_ids.length > 0 ? {
            create: subject_ids.map(id => ({ 
                id_subject: id,
                // Kolom dokumen diisi dengan NULL karena tidak ada di schema Anda saat ini
                // Pastikan id_subject valid
            }))
        } : undefined;

        // 4. SIMPAN KE DATABASE
        const newUser = await prisma.users.create({
            data: {
                username, email_user, nama_user, password: hashedPassword, 
                role: role || 'Contributor', 
                phone, 
                foto: fotoPath, // ⬅️ Menyimpan path dari Multer
                kompetensi: kompetensiData // Menyimpan relasi
            }
        });

        res.status(201).json({ message: 'User berhasil ditambahkan.', data: { id_user: newUser.id_user } });

    } catch (error) {
        // Jika ada crash, hapus file yang sudah terlanjur di-upload oleh Multer
        if (req.file) { fs.unlinkSync(req.file.path); } 
        console.error('Prisma/Database Error saat CREATE:', error); 
        res.status(500).json({ message: 'Gagal memproses data di server.' });
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
    const { username, email_user, nama_user, role, phone, foto, subject_ids, password } = req.body; 

    try {
        // 1. Validasi Dasar & Cek Keberadaan User (Logika tetap sama)
        if (role && !allowedRoles.includes(role)) { 
            return res.status(400).json({ message: `Nilai role '${role}' tidak valid.` }); 
        }
        
        const existingUser = await prisma.users.findUnique({ where: { id_user: userId } });
        if (!existingUser) { return res.status(404).json({ message: `User dengan ID ${userId} tidak ditemukan.` }); }
        
        // Cek Email Unik (Jika email diubah)
        if (email_user && email_user !== existingUser.email_user) {
            const emailCheck = await prisma.users.findFirst({ where: { email_user } });
            if (emailCheck) { return res.status(409).json({ message: 'Email baru sudah digunakan.' }); }
        }

        // 2. Siapkan Objek Data untuk Update (KOREKSI UTAMA ADA DI SINI)
        const updateData = {};
        
        // ⬇️ GUNAKAN 'IN REQ.BODY' UNTUK MEMASTIKAN DATA TERBACA ⬇️
        if ('username' in req.body) updateData.username = username;
        if ('nama_user' in req.body) updateData.nama_user = nama_user; // ⬅️ Masalah Utama Anda
        if ('role' in req.body) updateData.role = role;               // ⬅️ Masalah Utama Anda
        if ('phone' in req.body) updateData.phone = phone;
        if ('email_user' in req.body) updateData.email_user = email_user;
        if ('foto' in req.body) updateData.foto = foto; // Foto path dari JSON body
        // ⬆️ FIELD DASAR SELESAI ⬆️

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
            const newCompetencies = subject_ids.map(id => ({ id_subject: id }));
            
            updateData.kompetensi = { create: newCompetencies };
        }
        
        // 5. Penanganan Foto Multer (Tambahan: Jika ada file upload baru)
        if (req.file) { 
            // Tambahkan logika hapus foto lama dari disk di sini
            updateData.foto = req.file.path; // Update path dari Multer
        }

        // 6. Final Update
        if (Object.keys(updateData).length === 0) { 
            return res.status(400).json({ message: 'Tidak ada data valid yang dikirim untuk diperbarui.' }); 
        }

        const updatedUser = await prisma.users.update({
            where: { id_user: userId }, 
            data: updateData,
            select: { id_user: true, nama_user: true, email_user: true, role: true, foto: true } 
        });

        res.status(200).json({ message: `Data user '${updatedUser.nama_user}' berhasil diperbarui.`, data: updatedUser }); 

    } catch (error) {
        console.error('Prisma/Database Error saat UPDATE:', error);
        // Tambahkan logika untuk menghapus file yang gagal di-commit
        res.status(500).json({ message: 'Gagal memperbarui data user.' });
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
        

        // 5. Hapus User Utama
        await prisma.users.delete({ where: { id_user: userId } });

        res.status(200).json({ message: `User '${userToDelete.nama_user}' berhasil dihapus secara total.`, deletedUserId: userId }); 

    } catch (error) {
        // Jika masih ada error, kemungkinan error di tabel soal (id_contributor)
        console.error('Prisma/Database Error saat DELETE:', error);
        res.status(500).json({ message: 'Gagal menghapus: Ada data relasi lain yang tidak terhapus.' });
    }
};