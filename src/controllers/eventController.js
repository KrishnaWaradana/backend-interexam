const prisma = require('../config/prismaClient'); // Sesuaikan path
const fs = require('fs');
const path = require('path');

// --- HELPER: Hapus File ---
const deleteFile = (filePath) => {
    if (!filePath) return;
    const absolutePath = path.join(__dirname, '../', filePath);
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
};

// =================================================================
// 1. CREATE (ADD EVENT)
// =================================================================
exports.addEvent = async (req, res) => {
    const file = req.file;
    const { 
        nama_event, id_category, jenis, status, 
        tanggal_mulai, tanggal_selesai, durasi_pengerjaan, 
        deskripsi, paket_ids 
    } = req.body;

    let bannerPath = file ? `uploads/events/${file.filename}` : null;

    try {
        if (!nama_event || !id_category || !tanggal_mulai || !tanggal_selesai) {
            throw new Error("Data wajib (Nama, Kategori, Tanggal) tidak lengkap.");
        }

        // Parsing Data
        const categoryInt = parseInt(id_category);
        const durasiInt = parseInt(durasi_pengerjaan) || 0;
        
        let paketIdsArray = [];
        if (paket_ids) {
            try { paketIdsArray = JSON.parse(paket_ids); } 
            catch (e) { if (Array.isArray(paket_ids)) paketIdsArray = paket_ids; }
        }

        if (!paketIdsArray.length) throw new Error("Minimal harus memilih satu Paket Soal.");

        // Transaction: Save Event + Relasi
        const newEvent = await prisma.$transaction(async (tx) => {
            return await tx.event.create({
                data: {
                    nama_event,
                    id_category: categoryInt,
                    jenis,
                    status,
                    tanggal_mulai: new Date(tanggal_mulai),
                    tanggal_selesai: new Date(tanggal_selesai),
                    durasi_pengerjaan: durasiInt,
                    deskripsi,
                    banner: bannerPath,
                    eventPaket: {
                        create: paketIdsArray.map((id) => ({
                            paketSoal: { connect: { id_paket_soal: parseInt(id) } }
                        }))
                    }
                }
            });
        });

        res.status(201).json({ message: "Event berhasil dibuat.", data: newEvent });

    } catch (error) {
        if (bannerPath) deleteFile(bannerPath);
        res.status(500).json({ message: error.message || "Gagal menyimpan event." });
    }
};

// =================================================================
// 2. READ ALL (LIST EVENT)
// =================================================================
exports.getAllEvents = async (req, res) => {
    try {
        const { search, jenis, status } = req.query;
        const whereClause = {};

        if (search) whereClause.nama_event = { contains: search, mode: 'insensitive' };
        if (jenis && jenis !== 'all') whereClause.jenis = jenis;
        if (status && status !== 'all') whereClause.status = status;

        const events = await prisma.event.findMany({
            where: whereClause,
            include: {
                category: true,
                _count: { select: { eventPaket: true } }
            },
            orderBy: { created_at: 'desc' }
        });

        // Format Data untuk Frontend
        const formattedEvents = events.map(event => ({
            id: event.id_event,
            nama_event: event.nama_event,
            kategori: event.category ? event.category.nama_category : '-',
            jenis: event.jenis,
            status: event.status,
            jumlah_paket: event._count.eventPaket,
            tanggal_mulai: new Date(event.tanggal_mulai).toLocaleDateString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric'
            }),
            image: event.banner ? `${process.env.BASE_URL}/${event.banner}` : null
        }));

        res.json({ data: formattedEvents });

    } catch (error) {
        res.status(500).json({ message: "Gagal memuat data event." });
    }
};

// =================================================================
// 3. READ ONE (DETAIL EVENT)
// =================================================================
exports.getEventById = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await prisma.event.findUnique({
            where: { id_event: parseInt(id) },
            include: {
                eventPaket: { include: { paketSoal: true } }
            }
        });

        if (!event) return res.status(404).json({ message: "Event tidak ditemukan." });

        // Format Date untuk input 'datetime-local' (YYYY-MM-DDTHH:mm)
        const toLocalISO = (date) => {
             const d = new Date(date);
             d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
             return d.toISOString().slice(0, 16);
        };

        const formattedEvent = {
            ...event,
            tanggal_mulai: toLocalISO(event.tanggal_mulai),
            tanggal_selesai: toLocalISO(event.tanggal_selesai),
            bannerUrl: event.banner ? `${process.env.BASE_URL}/${event.banner}` : null,
            selectedPaket: event.eventPaket.map(ep => ({
                id: ep.paketSoal.id_paket_soal,
                nama_paket: ep.paketSoal.nama_paket,
                image: ep.paketSoal.image ? `${process.env.BASE_URL}/${ep.paketSoal.image}` : null
            }))
        };

        res.json({ data: formattedEvent });
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil detail event." });
    }
};

// =================================================================
// 4. UPDATE (EDIT EVENT)
// =================================================================
exports.updateEvent = async (req, res) => {
    const { id } = req.params;
    const file = req.file;
    const { 
        nama_event, id_category, jenis, status, 
        tanggal_mulai, tanggal_selesai, durasi_pengerjaan, 
        deskripsi, paket_ids 
    } = req.body;

    try {
        const oldEvent = await prisma.event.findUnique({ where: { id_event: parseInt(id) } });
        if (!oldEvent) {
            if (file) deleteFile(`uploads/events/${file.filename}`);
            return res.status(404).json({ message: "Event tidak ditemukan." });
        }

        let updateData = {
            nama_event,
            id_category: parseInt(id_category),
            jenis, status, deskripsi,
            durasi_pengerjaan: parseInt(durasi_pengerjaan),
            tanggal_mulai: new Date(tanggal_mulai),
            tanggal_selesai: new Date(tanggal_selesai),
        };

        if (file) {
            if (oldEvent.banner) deleteFile(oldEvent.banner);
            updateData.banner = `uploads/events/${file.filename}`;
        }

        await prisma.$transaction(async (tx) => {
            await tx.event.update({ where: { id_event: parseInt(id) }, data: updateData });

            if (paket_ids) {
                let ids = [];
                try { ids = JSON.parse(paket_ids); } catch (e) { if(Array.isArray(paket_ids)) ids = paket_ids; }
                
                // Reset & Insert Ulang Paket
                await tx.eventPaketSoal.deleteMany({ where: { id_event: parseInt(id) } });
                if (ids.length > 0) {
                    await tx.eventPaketSoal.createMany({
                        data: ids.map(pid => ({ id_event: parseInt(id), id_paket_soal: parseInt(pid) }))
                    });
                }
            }
        });

        res.json({ message: "Event berhasil diupdate." });

    } catch (error) {
        if (file) deleteFile(`uploads/events/${file.filename}`);
        res.status(500).json({ message: "Gagal mengupdate event." });
    }
};

// =================================================================
// 5. DELETE (HAPUS EVENT)
// =================================================================
exports.deleteEvent = async (req, res) => {
    const { id } = req.params;
    try {
        const event = await prisma.event.findUnique({ where: { id_event: parseInt(id) } });
        if (!event) return res.status(404).json({ message: "Event tidak ditemukan." });

        await prisma.event.delete({ where: { id_event: parseInt(id) } });
        if (event.banner) deleteFile(event.banner);

        res.json({ message: "Event berhasil dihapus." });
    } catch (error) {
        if (error.code === 'P2003') return res.status(400).json({ message: "Gagal: Event ini sedang digunakan." });
        res.status(500).json({ message: "Gagal menghapus event." });
    }
};

// =================================================================
// 6. HELPER: PACKAGES LOOKUP (MODAL)
// =================================================================
exports.getPackagesLookup = async (req, res) => {
    try {
        const { search, jenis } = req.query;
        const whereClause = { status: 'active' };
        
        if (search) whereClause.nama_paket = { contains: search, mode: 'insensitive' };
        if (jenis && jenis !== 'all') whereClause.jenis = jenis;

        const packages = await prisma.paketSoal.findMany({
            where: whereClause,
            select: { id_paket_soal: true, nama_paket: true, jumlah_soal: true, jenis: true, image: true, status: true },
            orderBy: { tanggal_dibuat: 'desc' },
            take: 20
        });

        const mappedData = packages.map(p => ({
            id: p.id_paket_soal,
            nama_paket: p.nama_paket,
            jumlah_soal: p.jumlah_soal || 0,
            jenis: p.jenis === 'gratis' ? 'Gratis' : 'Berbayar',
            status: p.status,
            image: p.image ? `${process.env.BASE_URL}/${p.image}` : null
        }));

        res.json({ data: mappedData });
    } catch (error) {
        res.status(500).json({ message: "Gagal memuat paket soal." });
    }
};