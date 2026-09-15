const env = require("../config/env");
const ApiError = require("../utils/ApiError");

/**
 * 404 handler — catches any request that didn't match a route.
 */
const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Converts known error types (Prisma, JWT, etc.) into ApiError
 * so the final handler can respond consistently.
 */
const normalizeError = (err, req) => {
  // Already a normalized ApiError
  if (err instanceof ApiError) {
    return err;
  }

  // Prisma known request errors
  if (err.code && typeof err.code === "string" && err.code.startsWith("P")) {
    // Log the original Prisma error so it is visible in Railway logs.
    // This is especially useful while diagnosing production database issues.
    // eslint-disable-next-line no-console
    console.error("[PRISMA ERROR]", {
      method: req?.method,
      url: req?.originalUrl,
      code: err.code,
      message: err.message,
      meta: err.meta,
      stack: err.stack,
    });

    // Unique constraint violation
    if (err.code === "P2002") {
      const target = err.meta?.target;

      return ApiError.conflict(
        `A record with this ${
          Array.isArray(target) ? target.join(", ") : "value"
        } already exists`,
      );
    }

    // Record not found
    if (err.code === "P2025") {
      return ApiError.notFound("Record not found");
    }

    // Foreign key constraint violation
    if (err.code === "P2003") {
      return ApiError.badRequest("Related record does not exist");
    }

    // Other Prisma/database errors
    return ApiError.badRequest("Database request error");
  }

  // JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return ApiError.unauthorized("Invalid or expired token");
  }

  // Unknown/unhandled error
  return new ApiError(
    err.statusCode || 500,
    err.message || "Internal Server Error",
  );
};

/**
 * Final global error handler.
 * Must be registered last, after all routes.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const apiError = normalizeError(err, req);

  // Log unexpected errors and all 5xx errors.
  if (!apiError.isOperational || apiError.statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error("[ERROR]", {
      method: req?.method,
      url: req?.originalUrl,
      statusCode: apiError.statusCode,
      message: err?.message,
      stack: err?.stack,
    });
  }

  res.status(apiError.statusCode || 500).json({
    success: false,
    statusCode: apiError.statusCode || 500,
    message: apiError.message || "Internal Server Error",
    errors: apiError.errors || undefined,
    stack: env.nodeEnv === "development" ? err.stack : undefined,
  });
};

module.exports = {
  notFound,
  errorHandler,
};
