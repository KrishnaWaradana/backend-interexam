const express = require('express');
const router = express.Router();

// Import Controller
const questionController = require('../../controllers/contributor/questionController'); 
const upload = require('../../middleware/upload'); 

// 1. READ (Lihat Daftar Soal & Detail Soal)
router.get('/my-questions', questionController.getQuestionsByContributor);
router.get('/question/:id', questionController.getQuestionDetail);

// 2. CREATE (Tambah Soal Baru)
router.post('/question', 
    upload.fields([
        { name: 'image_soal', maxCount: 1 },      
        { name: 'image_jawaban', maxCount: 10 },
        { name: 'image_pembahasan', maxCount: 1 }
    ]), 
    questionController.addQuestion 
); 

// 3. UPDATE
router.put('/question/:id', 
    upload.fields([
        { name: 'image_soal', maxCount: 1 },      
        { name: 'image_jawaban', maxCount: 10 },
        { name: 'image_pembahasan', maxCount: 1 }
    ]), 
    questionController.editQuestion 
);

// 4. DELETE
router.delete('/question/:id', 
    questionController.deleteQuestion 
);

module.exports = router;