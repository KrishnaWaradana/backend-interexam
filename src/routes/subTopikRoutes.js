const express = require('express');
const router = express.Router();
const controller = require('../controllers/subTopikController'); 

// 1. Create Sub-Topic
router.post('/', controller.createSubTopic);

// 2. Get All
router.get('/', controller.getSubTopics);

// 3. Get Detail (Untuk Preview HTML Materi)
router.get('/:id', controller.getSubTopicDetail);

// 4. Update
router.put('/:id', controller.updateSubTopic);

// 5. Delete
router.delete('/:id', controller.deleteSubTopic);

module.exports = router;