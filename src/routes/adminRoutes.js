// apps/backend/src/routes/adminRoutes.js

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); 
const subjectController = require('../controllers/subjectController');
const multer = require('multer'); 
const path = require('path');
const fs = require('fs'); 

// 1. IMPORT MIDDLEWARE KEAMANAN (Wajib ada!)
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

// Setup penyimpanan file (Multer)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Arahkan ke folder uploads/photos di luar src
        const uploadPath = path.join(__dirname, '../../uploads/photos');

        // CEK: Jika folder tidak ada, buat dulu!
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath); 
    },
    filename: (req, file, cb) => {
        // Nama file unik
        const uniqueName = 'user-' + Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
        cb(null, uniqueName);
    }
});

const upload = multer({ storage: storage });

// =================================================================
// ROUTE MANAGEMENT USERS
// =================================================================

router.get('/admin/roles', userController.getAllowedRoles); 
router.get('/admin/users', userController.getAllUsers); 
router.get('/admin/user/:id', userController.getUserById);

// Create User (Upload Foto)
router.post('/admin/user', upload.single('profile_picture'), userController.addUser);

// Update User Profile (Edit Nama/Foto/Pass) - Upload Foto
router.put('/admin/user/:id', upload.single('profile_picture'), userController.updateUser);

// Delete User
router.delete('/admin/user/:id', userController.deleteUser); 

// --- [BARU] UPDATE STATUS USER (APPROVE / SUSPEND) ---
// Ini endpoint yang dipakai Admin untuk mengaktifkan user Validator/Contributor
router.put(
    '/admin/user/:id/status', 
    authenticateToken,       // Wajib Login
    requireRole(['Admin']),  // Wajib Admin
    userController.changeUserStatus // Fungsi yang tadi kita tambahkan di controller
);

// =================================================================
// ROUTE MANAGEMENT SUBJECTS
// =================================================================

router.post('/admin/subject', subjectController.addSubject); 
router.get('/admin/subjects', subjectController.getAllSubjects); 
router.put('/admin/subject/:id', subjectController.updateSubject); 
router.delete('/admin/subject/:id', subjectController.deleteSubject);

module.exports = router;