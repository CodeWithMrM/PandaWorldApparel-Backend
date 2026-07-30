const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/**
 * Consistent JSON body for rate-limit rejections.
 */
const rateLimitHandler = (req, res /*, next, options */) => {
  res.status(429).json({
    success: false,
    statusCode: 429,
    message: 'Too many requests, please try again later.',
  });
};

/**
 * General limiter applied to the whole /api surface.
 * Generous enough for normal browsing/shopping traffic.
 */
const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Limiter for endpoints that create write-heavy or costly operations
 * (e.g. creating a payment session / an order). Keeps things sane
 * without punishing normal checkout flows.
 */
const writeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Limiter for the PayFast ITN (server-to-server notify) endpoint.
 * PayFast may retry notifications, so this is generous, but still bounded
 * to protect against abuse of a publicly reachable webhook URL.
 */
const paymentNotifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Limiter for the Clerk webhook endpoint. Same rationale as the PayFast
 * notify limiter: it's a publicly reachable URL that only Clerk should be
 * calling, but is bounded in case of retries/abuse.
 */
const clerkWebhookLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

module.exports = {
  generalLimiter,
  writeLimiter,
  paymentNotifyLimiter,
  clerkWebhookLimiter,
};
