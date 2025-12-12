// apps/backend/src/routes/contributor/soalRoutes.js

const express = require('express');
const router = express.Router();

// IMPORT MIDDLEWARE AUTH & ROLE di-comment/dihapus jika tidak digunakan
// const { authenticateToken, requireRole } = require('../../middleware/authMiddleware'); 

const questionLookupController = require('../../controllers/contributor/questionLookupController'); 
const questionController = require('../../controllers/contributor/questionController'); 
const upload = require('../../middleware/upload'); 

// Roles yang diizinkan untuk membuat soal
const rolesAllowed = ['Admin', 'Contributor'];

// =================================================================
// RUTE LOOKUP (DATA DROPDOWN)
// =================================================================
router.get('/lookup/subjects', questionLookupController.getSubjectsLookup); 
router.get('/lookup/topics/:subjectId', questionLookupController.getTopicsLookup);
router.get('/lookup/levels', questionLookupController.getLevelKesulitanLookup); 
router.get('/lookup/competent-subjects', questionController.getCompetentSubjects);

// =================================================================
// RUTE UTAMA: MANAJEMEN SOAL (CRUD)
// =================================================================

// 1. READ: Daftar Soal Contributor (Mode Debug Tanpa Auth)
router.get('/my-questions',
    // Tidak ada authenticateToken dan requireRole di sini
    questionController.getQuestionsByContributor 
);

// 2. CREATE: Buat Soal Baru (Support Multiple Images: Soal & Jawaban)
router.post(
    '/question', 
    // authenticateToken, 
    // requireRole(rolesAllowed), 
    
    // ⬇️ PERUBAHAN: Menggunakan fields untuk menangani banyak file sekaligus ⬇️
    upload.fields([
        { name: 'image_soal', maxCount: 1 },       // Max 1 gambar untuk soal
        { name: 'image_jawaban', maxCount: 10 }    // Max 10 gambar untuk opsi jawaban
    ]), 
    
    questionController.addQuestion 
); 

// 3. UPDATE: Edit Soal (Support Multiple Images: Soal & Jawaban)
router.put(
    '/question/:id', 
    // authenticateToken, 
    // requireRole(rolesAllowed), 
    
    // ⬇️ PERUBAHAN: Sama seperti POST, gunakan fields ⬇️
    upload.fields([
        { name: 'image_soal', maxCount: 1 },
        { name: 'image_jawaban', maxCount: 10 }
    ]),
    
    questionController.editQuestion 
);

// 4. DELETE: Hapus Soal
router.delete(
    '/question/:id', 
    // authenticateToken, 
    // requireRole(rolesAllowed), 
    questionController.deleteQuestion 
);

module.exports = router;