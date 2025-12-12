const express = require('express');
const router = express.Router();

const questionLookupController = require('../../controllers/contributor/questionLookupController'); 
const questionController = require('../../controllers/contributor/questionController'); 
const upload = require('../../middleware/upload'); 

const rolesAllowed = ['Admin', 'Contributor'];

// =================================================================
// RUTE LOOKUP 
// =================================================================
router.get('/lookup/subjects', questionLookupController.getSubjectsLookup); 
router.get('/lookup/topics/:subjectId', questionLookupController.getTopicsLookup);
router.get('/lookup/levels', questionLookupController.getLevelKesulitanLookup); 
router.get('/lookup/competent-subjects', questionController.getCompetentSubjects);

// =================================================================
// RUTE UTAMA: MANAJEMEN SOAL
// =================================================================

// 1. READ 
router.get('/my-questions',
    questionController.getQuestionsByContributor 
);

// 2. CREATE
router.post(
    '/question', 
    // authenticateToken, 
    // requireRole(rolesAllowed), 

    upload.fields([
        { name: 'image_soal', maxCount: 1 },      
        { name: 'image_jawaban', maxCount: 10 }  
    ]), 
    
    questionController.addQuestion 
); 

// 3. UPDATE
router.put(
    '/question/:id', 
    // authenticateToken, 
    // requireRole(rolesAllowed), 
    
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