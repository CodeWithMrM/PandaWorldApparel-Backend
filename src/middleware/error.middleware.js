const env = require('../config/env');
const ApiError = require('../utils/ApiError');

/**
 * 404 handler — catches any request that didn't match a route.
 */
const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Converts known error types (Prisma, Multer, JWT, etc.) into ApiError so
 * the final handler can respond consistently.
 */
const normalizeError = (err) => {
  if (err instanceof ApiError) return err;

  // Prisma known request errors (e.g. unique constraint violation, FK violation)
  if (err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    if (err.code === 'P2002') {
      const target = err.meta?.target;
      return ApiError.conflict(
        `A record with this ${Array.isArray(target) ? target.join(', ') : 'value'} already exists`
      );
    }
    if (err.code === 'P2025') {
      return ApiError.notFound('Record not found');
    }
    if (err.code === 'P2003') {
      return ApiError.badRequest('Related record does not exist');
    }
    return ApiError.badRequest('Database request error');
  }

  // Multer file upload errors
  if (err.name === 'MulterError') {
    return ApiError.badRequest(`Upload error: ${err.message}`);
  }

  // JWT errors that slip through
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Invalid or expired token');
  }

  return new ApiError(err.statusCode || 500, err.message || 'Internal Server Error');
};

/**
 * Final global error handler. Must be registered last, after all routes.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const apiError = normalizeError(err);

  if (!apiError.isOperational || apiError.statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  res.status(apiError.statusCode || 500).json({
    success: false,
    statusCode: apiError.statusCode || 500,
    message: apiError.message || 'Internal Server Error',
    errors: apiError.errors || undefined,
    stack: env.nodeEnv === 'development' ? err.stack : undefined,
  });
};

module.exports = { notFound, errorHandler };
