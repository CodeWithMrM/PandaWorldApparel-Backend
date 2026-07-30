const express = require('express');
const router = express.Router();

const categoryController = require('../controllers/category.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const {
  createCategoryValidator,
  updateCategoryValidator,
} = require('../validators/category.validator');

router.get('/', categoryController.listCategories);
router.get('/:id', categoryController.getCategory);

// Admin only
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  writeLimiter,
  validate(createCategoryValidator),
  categoryController.createCategory
);
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  writeLimiter,
  validate(updateCategoryValidator),
  categoryController.updateCategory
);
router.delete('/:id', authenticate, authorize('ADMIN'), writeLimiter, categoryController.deleteCategory);

module.exports = router;
