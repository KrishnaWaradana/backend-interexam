const prisma = require('../config/prismaClient'); 
const fs = require('fs');
const path = require('path');

const deleteFile = (filePath) => {
    if (!filePath) return;
    const absolutePath = path.join(__dirname, '../../', filePath); 
    if (fs.existsSync(absolutePath)) {
        try {
            fs.unlinkSync(absolutePath);
        } catch (err) {
            console.error("Gagal hapus file fisik:", err);
        }
    }
};

const generateImageUrl = (req, dbPath) => {
    if (!dbPath) return null;

    let cleanPath = dbPath.replace(/\\/g, "/");
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    return `${baseUrl}/${cleanPath}`;
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
            throw new Error("Data wajib tidak lengkap.");
        }

        const categoryInt = parseInt(id_category);
        const durasiInt = parseInt(durasi_pengerjaan) || 0;
        
        let paketIdsArray = [];
        if (paket_ids) {
            try { paketIdsArray = JSON.parse(paket_ids); } 
            catch (e) { if (Array.isArray(paket_ids)) paketIdsArray = paket_ids; }
        }

        if (!paketIdsArray.length) throw new Error("Minimal harus memilih satu Paket Soal.");

        const newEvent = await prisma.$transaction(async (tx) => {
            const event = await tx.event.create({
                data: {
                    nama_event,
                    id_category: categoryInt,
                    jenis, status,
                    tanggal_mulai: new Date(tanggal_mulai),
                    tanggal_selesai: new Date(tanggal_selesai),
                    durasi_pengerjaan: durasiInt,
                    deskripsi,
                    banner: bannerPath
                }
            });

            if (paketIdsArray.length > 0) {
                const relationData = paketIdsArray.map(pid => ({
                    id_event: event.id_event,
                    id_paket_soal: parseInt(pid)
                }));

                await tx.eventPaketSoal.createMany({
                    data: relationData
                });
            }

            return event;
        });

        res.status(201).json({ message: "Event berhasil dibuat.", data: newEvent });

    } catch (error) {
        if (bannerPath) deleteFile(bannerPath);
        res.status(500).json({ message: error.message || "Gagal menyimpan event." });
    }
};

// =================================================================
// 2. READ ALL (LIST EVENT) -> [INI PERBAIKAN UTAMA GAMBAR]
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
            image: generateImageUrl(req, event.banner) 
        }));

        res.json({ data: formattedEvents });

    } catch (error) {
        console.error("Error Get All:", error);
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
                eventPaket: { 
                    include: { 
                        paketSoal: {
                            select: {
                                id_paket_soal: true,
                                nama_paket: true,
                                jumlah_soal: true,
                                jenis: true,
                                image: true
                            }
                        } 
                    } 
                }
            }
        });

        if (!event) return res.status(404).json({ message: "Event tidak ditemukan." });

        const toLocalISO = (date) => {
             const d = new Date(date);
             d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
             return d.toISOString().slice(0, 16);
        };

        const formattedEvent = {
            ...event,
            tanggal_mulai: toLocalISO(event.tanggal_mulai),
            tanggal_selesai: toLocalISO(event.tanggal_selesai),
            bannerUrl: generateImageUrl(req, event.banner),
            
            selectedPaket: event.eventPaket.map(ep => ({
                id: ep.paketSoal.id_paket_soal,
                nama_paket: ep.paketSoal.nama_paket,
                jumlah_soal: ep.paketSoal.jumlah_soal || 0,
                // Normalisasi jenis agar Frontend bisa baca (Gratis/Berbayar)
                jenis: ep.paketSoal.jenis ? (ep.paketSoal.jenis.toLowerCase() === 'gratis' ? 'Gratis' : 'Berbayar') : 'Gratis',
                image: generateImageUrl(req, ep.paketSoal.image)
            }))
        };

        res.json({ data: formattedEvent });
    } catch (error) {
        console.error("Gagal Detail Event:", error); 
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
        const eventId = parseInt(id);
        const event = await prisma.event.findUnique({ where: { id_event: eventId } });
        
        if (!event) return res.status(404).json({ message: "Event tidak ditemukan." });
        await prisma.eventPaketSoal.deleteMany({ where: { id_event: eventId } });
        await prisma.event.delete({ where: { id_event: eventId } });
        if (event.banner) deleteFile(event.banner);

        res.json({ message: "Event berhasil dihapus." });
    } catch (error) {
        console.error("Delete Error:", error);
        if (error.code === 'P2003') {
            return res.status(400).json({ message: "Gagal: Event ini sedang digunakan oleh data lain." });
        }
        res.status(500).json({ message: "Gagal menghapus event." });
    }
};

// =================================================================
// 6. HELPER: PACKAGES LOOKUP (MODAL)
// =================================================================
exports.getPackagesLookup = async (req, res) => {
    try {
        const { search, jenis } = req.query;
        const whereClause = {};
        
        if (search) whereClause.nama_paket = { contains: search, mode: 'insensitive' };
        if (jenis && jenis !== 'all') {
            whereClause.jenis = jenis.toLowerCase(); 
        }

        const packages = await prisma.paketSoal.findMany({
            where: whereClause,
            select: { 
                id_paket_soal: true, nama_paket: true, jumlah_soal: true, 
                jenis: true, image: true, status: true 
            },
            orderBy: { tanggal_dibuat: 'desc' },
            take: 20
        });

        const mappedData = packages.map(p => ({
            id: p.id_paket_soal,
            nama_paket: p.nama_paket,
            jumlah_soal: p.jumlah_soal || 0,
            jenis: p.jenis === 'gratis' ? 'Gratis' : 'Berbayar',
            status: p.status,
            image: generateImageUrl(req, p.image) 
        }));

        res.json({ data: mappedData });
    } catch (error) {
        console.error("Error lookup paket:", error);
        res.status(500).json({ message: "Gagal memuat paket soal." });
    }
};