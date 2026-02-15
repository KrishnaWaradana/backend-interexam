const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Konfigurasi Disk Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Path absolut ke folder uploads di root project
        const rootPath = path.resolve(__dirname, '../../uploads');
        let uploadPath = path.join(rootPath, 'photos'); // Default

        // FILTER BERDASARKAN FIELDNAME DARI FRONTEND
        if (file.fieldname === 'image_soal' || file.fieldname === 'image') {
            uploadPath = path.join(rootPath, 'paket');
        } 
        else if (file.fieldname === 'fotoEvent') {
            uploadPath = path.join(rootPath, 'events');
        }

        // EKSEKUSI BUAT FOLDER OTOMATIS
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

// Konfigurasi Filter File (opsional, tapi disarankan)
const fileFilter = (req, file, cb) => {
    // Hanya izinkan format gambar
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Jenis file tidak didukung, hanya gambar (image) yang diizinkan.'), false);
    }
};

// Inisialisasi Multer
const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 1024 * 1024 * 5 // Batas ukuran file 5MB
    }
});

module.exports = upload;