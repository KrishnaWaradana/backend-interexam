const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Konfigurasi Disk Storage
const storage = multer.diskStorage({
    // 1. Destination (Penentuan Folder)
    destination: (req, file, cb) => {
        let uploadPath = path.join(__dirname, '../../uploads/photos'); // Default
        
        // Cek jika fieldname adalah 'image_soal', arahkan ke folder 'questions'
        if (file.fieldname === 'image_soal') {
            uploadPath = path.join(__dirname, '../../uploads/questions'); 
        }

        // Pastikan folder ada, jika tidak, buat
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },

    // 2. Filename (Penentuan Nama File Unik)
    filename: (req, file, cb) => {
        // Membuat nama file unik: fieldname-timestamp.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + fileExtension);
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