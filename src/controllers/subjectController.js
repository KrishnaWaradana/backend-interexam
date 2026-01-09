const prisma = require('../config/prismaClient'); 

// --- 1. CRUD CREATE (Add Subject) ---
exports.addSubject = async (req, res) => {
    const { nama_subject, keterangan } = req.body; 
    const userId = req.user.id; // Diambil dari token login

    try {
        if (!nama_subject) {
            return res.status(400).json({ message: 'Nama Subject wajib diisi.' });
        }
        
        // Memeriksa duplikasi khusus untuk user yang sedang login
        const existingSubject = await prisma.subjects.findFirst({
            where: { 
                nama_subject: nama_subject,
                id_user: userId 
            } 
        });
        
        if (existingSubject) {
            return res.status(409).json({ message: 'Subject ini sudah Anda buat sebelumnya.' });
        }

        const newSubject = await prisma.subjects.create({
            data: {
                nama_subject: nama_subject,
                keterangan: keterangan || null,
                id_user: userId // Menghubungkan subject ke pembuatnya
            }
        });

        res.status(201).json({ message: 'Subject berhasil ditambahkan.', data: newSubject });

    } catch (error) {
        console.error('Prisma Error saat CREATE Subject:', error);
        res.status(500).json({ message: 'Gagal memproses data Subject.' });
    }
};

// --- 2. CRUD READ (Get Subjects - Filtered by User) ---
exports.getAllSubjects = async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        // Logika: Admin bisa lihat semua, Guru/Lainnya hanya lihat miliknya sendiri
        const whereClause = userRole === 'Admin' ? {} : { id_user: userId };

        const subjects = await prisma.subjects.findMany({
            where: whereClause,
            select: { id_subject: true, nama_subject: true, keterangan: true, id_user: true }, 
            orderBy: { nama_subject: 'asc' }
        });

        const subjectsWithKeterangan = subjects.map(s => ({
            id_subject: s.id_subject,
            nama_subject: s.nama_subject,
            keterangan: s.keterangan || "" ,
            id_user: userId
        }));

        res.status(200).json({ 
            message: 'Daftar Subject berhasil diambil.', 
            data: subjectsWithKeterangan 
        });

    } catch (error) {
        console.error('Prisma Error saat READ Subject:', error);
        res.status(500).json({ message: 'Gagal mengambil data Subject.' });
    }
};

// --- 3. CRUD UPDATE (Update Subject with Protection) ---
exports.updateSubject = async (req, res) => {
    const subjectId = parseInt(req.params.id);
    const { nama_subject, keterangan } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        const existingSubject = await prisma.subjects.findUnique({
            where: { id_subject: subjectId }
        });

        if (!existingSubject) {
            return res.status(404).json({ message: 'Subject tidak ditemukan.' });
        }

        // PROTEKSI: Jika bukan miliknya dan bukan Admin, dilarang edit
        if (existingSubject.id_user !== userId && userRole !== 'Admin') {
            return res.status(403).json({ message: 'Anda tidak memiliki hak akses untuk mengubah subject ini.' });
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

// --- 4. CRUD DELETE (Delete Subject with Protection) ---
exports.deleteSubject = async (req, res) => {
    const subjectId = parseInt(req.params.id);
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        const existingSubject = await prisma.subjects.findUnique({
            where: { id_subject: subjectId }
        });

        if (!existingSubject) {
            return res.status(404).json({ message: 'Subject tidak ditemukan.' });
        }

        // PROTEKSI: Jika bukan miliknya dan bukan Admin, dilarang hapus
        if (existingSubject.id_user !== userId && userRole !== 'Admin') {
            return res.status(403).json({ message: 'Akses ditolak.' });
        }

        await prisma.subjects.delete({
            where: { id_subject: subjectId }
        });

        res.status(200).json({ message: 'Subject berhasil dihapus.' });

    } catch (error) {
        console.error('Prisma Error saat DELETE Subject:', error);
        if (error.code === 'P2003') {
            return res.status(409).json({ message: 'Gagal hapus: Subject masih terikat dengan data lain.' });
        }
        res.status(500).json({ message: 'Gagal menghapus Subject.' });
    }
};