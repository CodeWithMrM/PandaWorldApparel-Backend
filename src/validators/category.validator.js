const { body } = require('express-validator');

const createCategoryValidator = [
  body('name').trim().notEmpty().withMessage('Category name is required').isLength({ max: 100 }),
];

const updateCategoryValidator = [
  body('name').trim().notEmpty().withMessage('Category name cannot be empty').isLength({ max: 100 }),
];

module.exports = { createCategoryValidator, updateCategoryValidator };
