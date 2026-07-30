const { body } = require('express-validator');

const VALID_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const createOrderValidator = [
  body('shippingAddress')
    .trim()
    .notEmpty()
    .withMessage('shippingAddress is required')
    .isLength({ max: 500 }),
];

const updateOrderStatusValidator = [
  body('status')
    .trim()
    .notEmpty()
    .withMessage('status is required')
    .isIn(VALID_STATUSES)
    .withMessage(`status must be one of: ${VALID_STATUSES.join(', ')}`),
];

module.exports = { createOrderValidator, updateOrderStatusValidator, VALID_STATUSES };
