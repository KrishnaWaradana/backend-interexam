const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. GET ALL CATEGORIES
exports.getAllCategories = async (req, res) => {
    try {
        const categories = await prisma.categories.findMany({
            orderBy: { id_category: 'asc' }
        });
        
        res.status(200).json({ data: categories });
    } catch (error) {
        console.error("Error getAllCategories:", error);
        res.status(500).json({ message: "Gagal mengambil data kategori." });
    }
};

// 2. CREATE CATEGORY
exports.createCategory = async (req, res) => {
    const { nama_category, keterangan } = req.body;

    if (!nama_category) {
        return res.status(400).json({ message: "Nama kategori wajib diisi." });
    }

    try {
        const newCategory = await prisma.categories.create({
            data: {
                nama_category,
                keterangan
            }
        });

        res.status(201).json({ 
            message: "Kategori berhasil dibuat!", 
            data: newCategory 
        });
    } catch (error) {
        console.error("Error createCategory:", error);
        res.status(500).json({ message: "Gagal membuat kategori." });
    }
};

// 3. UPDATE CATEGORY
exports.updateCategory = async (req, res) => {
    const { id } = req.params;
    const { nama_category, keterangan } = req.body;

    try {
        // Cek dulu datanya ada gak
        const existing = await prisma.categories.findUnique({
            where: { id_category: parseInt(id) }
        });

        if (!existing) {
            return res.status(404).json({ message: "Kategori tidak ditemukan." });
        }

        const updatedCategory = await prisma.categories.update({
            where: { id_category: parseInt(id) },
            data: {
                nama_category,
                keterangan
            }
        });

        res.status(200).json({ 
            message: "Kategori berhasil diupdate!", 
            data: updatedCategory 
        });
    } catch (error) {
        console.error("Error updateCategory:", error);
        res.status(500).json({ message: "Gagal update kategori." });
    }
};

// 4. DELETE CATEGORY
exports.deleteCategory = async (req, res) => {
    const { id } = req.params;

    try {
        // Cek dulu apakah kategori ini dipakai di Paket Soal?
        // Kalau dipakai, biasanya Prisma akan error Foreign Key Constraint
        // Kecuali kamu set onDelete: Cascade di schema.
        
        await prisma.categories.delete({
            where: { id_category: parseInt(id) }
        });

        res.status(200).json({ message: "Kategori berhasil dihapus." });
    } catch (error) {
        console.error("Error deleteCategory:", error);
        
        // Handle error jika kategori sedang dipakai
        if (error.code === 'P2003') {
            return res.status(400).json({ 
                message: "Gagal hapus. Kategori ini sedang digunakan di Paket Soal atau Subjek." 
            });
        }
        
        res.status(500).json({ message: "Gagal menghapus kategori." });
    }
};