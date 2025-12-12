// apps/backend/src/routes/adminRoutes.js

const express = require('express');
const router = express.Router();
const multer = require('multer'); 
const path = require('path');
const fs = require('fs'); 

// --- IMPORT CONTROLLERS ---
const userController = require('../controllers/userController'); 
const subjectController = require('../controllers/subjectController');
const paketSoalController = require('../controllers/paketSoalController'); // Pastikan file ini sudah dibuat

// --- IMPORT MIDDLEWARE KEAMANAN ---
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');


// =================================================================
// KONFIGURASI UPLOAD FILE (MULTER)
// =================================================================

// 1. Storage untuk Foto Profil User (Disimpan di uploads/photos)
const storageUser = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../uploads/photos');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath); 
    },
    filename: (req, file, cb) => {
        const uniqueName = 'user-' + Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
        cb(null, uniqueName);
    }
});
const uploadUser = multer({ storage: storageUser });

// 2. Storage untuk Cover Paket Soal (Disimpan di uploads/paket)
const storagePaket = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../uploads/paket');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath); 
    },
    filename: (req, file, cb) => {
        const uniqueName = 'paket-' + Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
        cb(null, uniqueName);
    }
});
const uploadPaket = multer({ storage: storagePaket });


// =================================================================
// ROUTE MANAGEMENT USERS
// =================================================================

router.get('/admin/roles', userController.getAllowedRoles); 
router.get('/admin/users', userController.getAllUsers); 
router.get('/admin/user/:id', userController.getUserById);

// Create User (Upload Foto)
router.post('/admin/user', uploadUser.single('profile_picture'), userController.addUser);

// Update User Profile (Upload Foto)
router.put('/admin/user/:id', uploadUser.single('profile_picture'), userController.updateUser);

// Delete User
router.delete('/admin/user/:id', userController.deleteUser); 

// UPDATE STATUS USER (Approve / Suspend) - Khusus Admin
router.put(
    '/admin/user/:id/status', 
    authenticateToken,       // Wajib Login
    requireRole(['Admin']),  // Wajib Admin
    userController.changeUserStatus
);


// =================================================================
// ROUTE MANAGEMENT SUBJECTS
// =================================================================

router.post('/admin/subject', subjectController.addSubject); 
router.get('/admin/subjects', subjectController.getAllSubjects); 
router.put('/admin/subject/:id', subjectController.updateSubject); 
router.delete('/admin/subject/:id', subjectController.deleteSubject);


// =================================================================
// ROUTE MANAGEMENT PAKET SOAL (BARU)
// =================================================================

// 1. Get Data Bank Soal (Untuk Modal Pemilihan Soal)
router.get('/admin/bank-soal', authenticateToken, paketSoalController.getBankSoal);

// 2. Get All Paket Soal (List Dashboard)
router.get('/admin/paket-soal', authenticateToken, paketSoalController.getAllPaket);

// 3. Get Detail Paket Soal (Untuk Halaman Edit)
router.get('/admin/paket-soal/:id', authenticateToken, paketSoalController.getPaketById);

// 4. Create Paket Soal (Upload Cover + Simpan)
router.post(
    '/admin/paket-soal', 
    authenticateToken, 
    requireRole(['Admin']), 
    uploadPaket.single('image'), // Upload file 'image'
    paketSoalController.createPaketSoal
);

// 5. Update Paket Soal (Edit Data + Edit Soal + Ganti Foto)
router.put(
    '/admin/paket-soal/:id', 
    authenticateToken, 
    requireRole(['Admin']), 
    uploadPaket.single('image'), 
    paketSoalController.updatePaketSoal
);

// 6. Update Status Paket Saja (Toggle Switch: Active/Inactive)
router.patch(
    '/admin/paket-soal/:id/status', 
    authenticateToken, 
    requireRole(['Admin']), 
    paketSoalController.updateStatusPaket
);

// 7. Delete Paket Soal
router.delete(
    '/admin/paket-soal/:id', 
    authenticateToken, 
    requireRole(['Admin']), 
    paketSoalController.deletePaketSoal
);

module.exports = router;