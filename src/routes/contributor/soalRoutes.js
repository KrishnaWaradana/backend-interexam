// apps/backend/src/routes/contributor/soalRoutes.js

const express = require('express');
const router = express.Router();

// ⬅️ Pastikan IMPORT MIDDLEWARE AUTH & ROLE di-comment/dihapus jika tidak digunakan
// const { authenticateToken, requireRole } = require('../../middleware/authMiddleware'); 

const questionLookupController = require('../../controllers/contributor/questionLookupController'); 
// ⬇️ INI ADALAH OBJEK YANG HARUS ANDA PASTIKAN DIEKSPOR DENGAN BENAR DI CONTROLLER ⬇️
const questionController = require('../../controllers/contributor/questionController'); 
const upload = require('../../middleware/upload'); 

// Roles yang diizinkan untuk membuat soal
const rolesAllowed = ['Admin', 'Contributor'];

// Rute Data Lookup (Dropdowns)
router.get('/lookup/subjects', questionLookupController.getSubjectsLookup); 
router.get('/lookup/topics/:subjectId', questionLookupController.getTopicsLookup);
router.get('/lookup/levels', questionLookupController.getLevelKesulitanLookup); 

// 1. Rute READ Soal Contributor (Mode Debug Tanpa Auth)
router.get('/my-questions',
    // Tidak ada authenticateToken dan requireRole di sini
    questionController.getQuestionsByContributor // ✅ Handler
);

// 2. Rute CREATE Soal (dengan upload gambar - Mode Debug Tanpa Auth)
router.post(
    '/question', 
    //authenticateToken, 
    //requireRole(rolesAllowed), 
    upload.single('image_soal'), 
    questionController.addQuestion // ✅ Handler
); 

// 3. Rute UPDATE Soal (PUT /question/:id)
router.put(
    '/question/:id', 
    //authenticateToken, 
    //requireRole(rolesAllowed), 
    upload.single('image_soal'), 
    questionController.editQuestion // ✅ Handler
);
router.delete(
        '/question/:id', // ⬅️ Memerlukan ID Soal
        // authenticateToken, // Dihapus/di-comment untuk mode debug
        // requireRole(rolesAllowed), // Dihapus/di-comment untuk mode debug
        questionController.deleteQuestion // ⬅️ Controller baru
    );

    router.get('/lookup/competent-subjects', 
        questionController.getCompetentSubjects // ⬅️ Handler baru
    );
module.exports = router;