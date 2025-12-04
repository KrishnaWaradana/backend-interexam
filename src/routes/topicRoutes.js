const express = require('express');
const router = express.Router();
const topicController = require('../controllers/topicController');

// CREATE
router.post('/', topicController.createTopic);

// READ ALL
router.get('/', topicController.getAllTopics);

// READ ONE
router.get('/:id', topicController.getTopicById);

// UPDATE
router.put('/:id', topicController.updateTopic);

// DELETE
router.delete('/:id', topicController.deleteTopic);

module.exports = router;