const express = require('express');
const router = express.Router();

const productController = require('../controllers/product.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const { uploadProductImage } = require('../middleware/upload.middleware');
const {
  createProductValidator,
  updateProductValidator,
} = require('../validators/product.validator');

// Public
router.get('/', productController.listProducts);
router.get('/:id', productController.getProduct);

// Admin only. `uploadProductImage` runs before validation so that
// multipart/form-data text fields are parsed into req.body first.
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  writeLimiter,
  uploadProductImage,
  validate(createProductValidator),
  productController.createProduct
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  writeLimiter,
  uploadProductImage,
  validate(updateProductValidator),
  productController.updateProduct
);

router.delete('/:id', authenticate, authorize('ADMIN'), writeLimiter, productController.deleteProduct);

module.exports = router;
