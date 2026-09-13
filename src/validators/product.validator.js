const { body } = require('express-validator');

const createProductValidator = [
  body('name').trim().notEmpty().withMessage('Product name is required').isLength({ max: 200 }),
  body('description').optional({ checkFalsy: true }).isString(),
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ gt: 0 })
    .withMessage('Price must be a positive number'),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  body('categoryId').trim().notEmpty().withMessage('categoryId is required'),
  body('imageUrl').optional({ checkFalsy: true }).isURL({ protocols: ['https'], require_protocol: true }).withMessage('imageUrl must be an HTTPS URL'),
  body('imageFileId').optional({ checkFalsy: true }).isString().trim().notEmpty().withMessage('imageFileId cannot be empty'),
];

const updateProductValidator = [
  body('name').optional().trim().notEmpty().withMessage('Product name cannot be empty').isLength({ max: 200 }),
  body('description').optional({ checkFalsy: true }).isString(),
  body('price').optional().isFloat({ gt: 0 }).withMessage('Price must be a positive number'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('categoryId').optional().trim().notEmpty().withMessage('categoryId cannot be empty'),
  body('imageUrl').optional({ checkFalsy: true }).isURL({ protocols: ['https'], require_protocol: true }).withMessage('imageUrl must be an HTTPS URL'),
  body('imageFileId').optional({ checkFalsy: true }).isString().trim().notEmpty().withMessage('imageFileId cannot be empty'),
];

module.exports = { createProductValidator, updateProductValidator };
