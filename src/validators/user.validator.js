const { body } = require('express-validator');

// Email and password are managed by Clerk, not this API, so only
// locally-owned profile fields are validated here.
const updateProfileValidator = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 100 }),
  body('phone').optional({ checkFalsy: true }).isString().isLength({ max: 30 }),
];

module.exports = { updateProfileValidator };
