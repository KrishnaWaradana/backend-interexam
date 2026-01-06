const express = require('express');
const router = express.Router();

const subjectController = require('../../controllers/subjectController');
const jenjangController = require('../../controllers/jenjangController');
const topicController = require('../../controllers/topicController');
const { authenticateToken } = require('../../middleware/authMiddleware');


router.get('/subjects',authenticateToken, subjectController.getAllSubjects);

router.get('/jenjang',authenticateToken, jenjangController.getAllJenjang);

router.get('/topics/:subjectId', authenticateToken,topicController.getTopicsBySubjectId);

module.exports = router;