const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// Prefix URL nanti: /api/admin/categories

// GET - Bisa diakses Validator/Admin/Contributor
router.get('/', authenticateToken, categoryController.getAllCategories);

// POST - Hanya Admin
router.post('/', authenticateToken, requireRole(['Admin', 'Validator']), categoryController.createCategory);

// PUT - Hanya Admin
router.put('/:id', authenticateToken, requireRole(['Admin', 'Validator']), categoryController.updateCategory);

// DELETE - Hanya Admin
router.delete('/:id', authenticateToken, requireRole(['Admin', 'Validator']), categoryController.deleteCategory);

module.exports = router;