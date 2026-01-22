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
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');


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

router.get('/admin/roles',authenticateToken, userController.getAllowedRoles); 
router.get('/admin/users',authenticateToken, userController.getAllUsers); 
router.get('/admin/user/:id',authenticateToken, userController.getUserById);
router.get('/admin/subjects-list',authenticateToken, userController.getAllSubjects);

// Create User (Upload Foto)
router.post('/admin/user',authenticateToken, uploadUser.single('profile_picture'), userController.addUser);

// Update User Profile (Upload Foto)
router.put('/admin/user/:id',authenticateToken, uploadUser.single('profile_picture'), userController.updateUser);

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

router.post('/admin/subject', authenticateToken, subjectController.addSubject); 
router.get('/admin/subjects', authenticateToken, subjectController.getAllSubjects); 
router.put('/admin/subject/:id', authenticateToken, subjectController.updateSubject); 
router.delete('/admin/subject/:id', authenticateToken, subjectController.deleteSubject);


module.exports = router;