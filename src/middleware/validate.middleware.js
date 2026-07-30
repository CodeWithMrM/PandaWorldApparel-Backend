const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Takes an array of express-validator chains, runs them, and if any failed,
 * forwards a consistent 400 ApiError with a `errors` array.
 *
 * Usage: router.post('/', validate(createProductValidator), controller.createProduct)
 */
const validate = (validations) => async (req, res, next) => {
  await Promise.all(validations.map((validation) => validation.run(req)));

  const result = validationResult(req);
  if (result.isEmpty()) {
    return next();
  }

  const errors = result.array().map((err) => ({
    field: err.path,
    message: err.msg,
  }));

  next(ApiError.badRequest('Validation failed', errors));
};

module.exports = validate;
