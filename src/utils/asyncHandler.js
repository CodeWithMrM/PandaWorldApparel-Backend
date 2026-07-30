/**
 * Wraps an async Express route/controller so any thrown error or rejected
 * promise is forwarded to next(), where the global error handler deals with it.
 *
 * Usage: router.get('/', asyncHandler(controller.list))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
