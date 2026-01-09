const express = require('express');
const router = express.Router();
const topicController = require('../controllers/topicController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const questionLookupController = require('../controllers/contributor/questionLookupController');
// CREATE
router.post('/',authenticateToken , topicController.createTopic);

// READ ALL
router.get('/',authenticateToken, topicController.getAllTopics);

// READ ONE
router.get('/:id',authenticateToken,  topicController.getTopicById);

// UPDATE
router.put('/:id',authenticateToken, topicController.updateTopic);

// DELETE
router.delete('/:id',authenticateToken, topicController.deleteTopic);

router.get('/lookup/my-subjects', authenticateToken, questionLookupController.getSubjectsLookup);

module.exports = router;