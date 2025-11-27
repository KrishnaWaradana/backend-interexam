// apps/backend/src/routes/adminRoutes.js

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); 
const multer = require('multer'); // Import Multer
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Tentukan folder di mana file akan disimpan (DIPERLUKAN UNTUK UPLOAD)
        cb(null, path.join(__dirname, '..', 'uploads', 'photos')); 
    },
    filename: (req, file, cb) => {
        // Beri nama file unik
        cb(null, 'user-' + Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// 0. GET ALL ROLES (Untuk dropdown Role)
router.get('/admin/roles', userController.getAllowedRoles); 

// 0.5 GET ALL SUBJECTS (Untuk dropdown Keahlian)
router.get('/admin/subjects', userController.getAllSubjects); 

// 1. CREATE
router.post('/admin/user', 
    upload.single('profile_picture'), 
    userController.addUser 
);
// 2. READ All
router.get('/admin/users', userController.getAllUsers); 

// 3. UPDATE
router.put('/admin/user/:id', 
    upload.single('profile_picture'), // ⬅️ Middleware untuk file upload
    userController.updateUser);
// 4. DELETE
router.delete('/admin/user/:id', userController.deleteUser); 

module.exports = router;