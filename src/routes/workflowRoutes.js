const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflowController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get(
  '/alerts', 
  authenticateToken, 
  workflowController.getUserNotifications
);
router.put(
  '/alerts/read', 
  authenticateToken, 
  workflowController.markAsRead
);
router.post(
  '/submit-soal',
  authenticateToken,
  requireRole(['Contributor']), 
  workflowController.submitSoalWithNotif
);
router.post(
  '/reject-soal',
  authenticateToken,
  requireRole(['Admin', 'Validator']), 
  workflowController.rejectSoalWithNotif
);

module.exports = router;