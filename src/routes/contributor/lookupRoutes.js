const express = require('express');
const router = express.Router();

const subjectController = require('../../controllers/subjectController');
const jenjangController = require('../../controllers/jenjangController');
const topicController = require('../../controllers/topicController');


router.get('/subjects', subjectController.getAllSubjects);

router.get('/jenjang', jenjangController.getAllJenjang);

router.get('/topics/:subjectId', topicController.getTopicsBySubjectId);

module.exports = router;