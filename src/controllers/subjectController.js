// apps/backend/src/controllers/subjectController.js

const prisma = require('../config/prismaClient'); 

// --- 1. CRUD CREATE (Add Subject) ---
exports.addSubject = async (req, res) => {
    const { nama_subject, keterangan } = req.body; 

    try {
        if (!nama_subject) {
            return res.status(400).json({ message: 'Nama Subject wajib diisi.' });
        }
        
        // Memeriksa duplikasi menggunakan findFirst (Solusi tanpa mengubah schema)
        const existingSubject = await prisma.subjects.findFirst({
            where: { nama_subject: nama_subject } 
        });
        
        if (existingSubject) {
            return res.status(409).json({ message: 'Subject ini sudah terdaftar. Gunakan nama lain.' });
        }

        const newSubject = await prisma.subjects.create({
            data: {
                nama_subject: nama_subject,
                keterangan: keterangan || null
            }
        });

        res.status(201).json({ message: 'Subject berhasil ditambahkan.', data: newSubject });

    } catch (error) {
        console.error('Prisma Error saat CREATE Subject:', error);
        res.status(500).json({ message: 'Gagal memproses data Subject.' });
    }
};

// --- 2. CRUD READ (Get All Subjects) ---
exports.getAllSubjects = async (req, res) => {
    try {
        const subjects = await prisma.subjects.findMany({
            select: { id_subject: true, nama_subject: true, keterangan: true },
            orderBy: { nama_subject: 'asc' }
        });

        res.status(200).json({ message: 'Daftar Subject berhasil diambil.', data: subjects });
    } catch (error) {
        console.error('Prisma Error saat READ Subject:', error);
        res.status(500).json({ message: 'Gagal mengambil data Subject.' });
    }
};

// --- 3. CRUD UPDATE (Update Subject) ---
exports.updateSubject = async (req, res) => {
    const subjectId = parseInt(req.params.id);
    const { nama_subject, keterangan } = req.body;

    try {
        const existingSubject = await prisma.subjects.findUnique({
            where: { id_subject: subjectId }
        });
        if (!existingSubject) {
            return res.status(404).json({ message: 'Subject tidak ditemukan.' });
        }
        
        // Cek apakah nama_subject baru sudah terpakai oleh Subject lain (kecuali diri sendiri)
        if (nama_subject && nama_subject !== existingSubject.nama_subject) {
             const checkDuplicate = await prisma.subjects.findFirst({
                where: { nama_subject: nama_subject }
            });
            if (checkDuplicate) {
                return res.status(409).json({ message: 'Nama Subject baru sudah digunakan.' });
            }
        }

        const updatedSubject = await prisma.subjects.update({
            where: { id_subject: subjectId },
            data: {
                nama_subject: nama_subject,
                keterangan: keterangan
            }
        });

        res.status(200).json({ message: 'Subject berhasil diperbarui.', data: updatedSubject });

    } catch (error) {
        console.error('Prisma Error saat UPDATE Subject:', error);
        res.status(500).json({ message: 'Gagal memperbarui Subject.' });
    }
};

// --- 4. CRUD DELETE (Delete Subject) ---
exports.deleteSubject = async (req, res) => {
    const subjectId = parseInt(req.params.id);

    try {
        await prisma.subjects.delete({
            where: { id_subject: subjectId }
        });

        res.status(200).json({ message: 'Subject berhasil dihapus.' });

    } catch (error) {
        console.error('Prisma Error saat DELETE Subject:', error);
        // Tangani Foreign Key jika Subject terikat (ke User/Topics)
        if (error.code === 'P2003') {
            return res.status(409).json({ message: 'Gagal hapus: Subject masih terikat dengan Topik atau data User (Kompetensi).' });
        }
        res.status(500).json({ message: 'Gagal menghapus Subject.' });
    }
};