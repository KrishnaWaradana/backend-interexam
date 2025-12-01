const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); 
const multer = require('multer'); 
const path = require('path');
const fs = require('fs'); // <--- PENTING: Tambahkan ini
const subjectController = require('../controllers/subjectController');

// Setup penyimpanan file
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

// Routes
router.get('/admin/roles', userController.getAllowedRoles); 
router.get('/admin/subjects', userController.getAllSubjects); 
router.get('/admin/users', userController.getAllUsers); 
router.delete('/admin/user/:id', userController.deleteUser); 
router.get('/admin/user/:id', userController.getUserById);
// Create User (Upload Foto)
router.post('/admin/user', upload.single('profile_picture'), userController.addUser);

// Update User (Upload Foto)
router.put('/admin/user/:id', upload.single('profile_picture'), userController.updateUser);

router.post('/admin/subject', subjectController.addSubject); 

// 6. READ All Subjects
router.get('/admin/subjects', subjectController.getAllSubjects); 

// 7. UPDATE Subject
router.put('/admin/subject/:id', subjectController.updateSubject); 

// 8. DELETE Subject
router.delete('/admin/subject/:id', subjectController.deleteSubject);

module.exports = router;