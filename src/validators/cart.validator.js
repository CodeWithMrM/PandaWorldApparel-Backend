const { body } = require('express-validator');
const { PRODUCT_SIZES } = require('../utils/productSizes');

const addCartItemValidator = [
  body('productId').trim().notEmpty().withMessage('productId is required'),
  body('size')
    .trim()
    .notEmpty()
    .withMessage('size is required')
    .isIn(PRODUCT_SIZES)
    .withMessage(`size must be one of: ${PRODUCT_SIZES.join(', ')}`),
  body('quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('quantity must be a positive integer'),
];

const updateCartItemValidator = [
  body('quantity')
    .notEmpty()
    .withMessage('quantity is required')
    .isInt({ min: 1 })
    .withMessage('quantity must be a positive integer'),
];

module.exports = { addCartItemValidator, updateCartItemValidator };
