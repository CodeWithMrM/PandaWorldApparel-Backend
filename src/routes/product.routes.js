const express = require('express');
const router = express.Router();

const productController = require('../controllers/product.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const {
  createProductValidator,
  updateProductValidator,
} = require('../validators/product.validator');

// Public
router.get('/', productController.listProducts);
router.get('/:id', productController.getProduct);

router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  writeLimiter,
  validate(createProductValidator),
  productController.createProduct
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  writeLimiter,
  validate(updateProductValidator),
  productController.updateProduct
);

router.delete('/:id', authenticate, authorize('ADMIN'), writeLimiter, productController.deleteProduct);

module.exports = router;
