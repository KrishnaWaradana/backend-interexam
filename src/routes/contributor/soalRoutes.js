const express = require('express');
const router = express.Router();

// --- IMPORT CONTROLLER ---
const questionController = require('../../controllers/contributor/questionController'); 
// TAMBAHKAN INI (Sesuaikan path file-nya)
const questionLookupController = require('../../controllers/contributor/questionLookupController');

const upload = require('../../middleware/upload'); 
const { authenticateToken, requireRole } = require('../../middleware/authMiddleware');

// --- 1. LOOKUP DATA (Dropdowns) ---
// Cari bagian lookup di soalRoutes.js kamu dan ganti baris subject-nya
router.get('/lookup/my-subjects', authenticateToken, questionLookupController.getSubjectsLookup);
router.get('/lookup/topics/:subjectId', authenticateToken, questionLookupController.getTopicsLookup);
router.get('/lookup/levels', authenticateToken, questionLookupController.getLevelKesulitanLookup);

// --- 2. READ SOAL ---
router.get('/my-questions', authenticateToken, questionController.getQuestionsByContributor);
router.get('/question/:id', authenticateToken, questionController.getQuestionDetail);

// --- 3. CREATE SOAL ---
router.post('/question', 
    authenticateToken, 
    requireRole(['Contributor']),
    upload.fields([
        { name: 'image_soal', maxCount: 1 },      
        { name: 'image_jawaban', maxCount: 10 },
        { name: 'image_pembahasan', maxCount: 1 }
    ]), 
    questionController.addQuestion 
); 

// --- 4. UPDATE SOAL ---
router.put('/question/:id', 
    authenticateToken,
    requireRole(['Contributor']),
    upload.fields([
        { name: 'image_soal', maxCount: 1 },      
        { name: 'image_jawaban', maxCount: 10 },
        { name: 'image_pembahasan', maxCount: 1 }
    ]), 
    questionController.editQuestion 
);

// --- 5. DELETE SOAL ---
router.delete('/question/:id', authenticateToken, requireRole(['Contributor']), questionController.deleteQuestion);

module.exports = router;