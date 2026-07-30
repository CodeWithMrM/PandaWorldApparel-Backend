const { body } = require('express-validator');

const addCartItemValidator = [
  body('productId').trim().notEmpty().withMessage('productId is required'),
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
