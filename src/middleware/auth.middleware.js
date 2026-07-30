const { clerkMiddleware, getAuth, clerkClient } = require('@clerk/express');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../config/prisma');

/**
 * Clerk's official middleware. Mounted globally in app.js — it parses the
 * session token (if present) and attaches auth state to `req.auth`, but
 * does NOT reject unauthenticated requests by itself. Use `authenticate`
 * below on routes that require a logged-in user.
 */
const withClerk = clerkMiddleware();

/**
 * Requires a valid Clerk session, resolves the corresponding local `User`
 * row (creating it as a safety net if the webhook hasn't fired yet), and
 * attaches a normalised `req.user` object used throughout the app.
 *
 * The ADMIN/CUSTOMER role is treated as authoritative from Clerk's
 * `publicMetadata.role` — not from a token claim the client could tamper
 * with — so we resolve it via the Clerk backend SDK on each request.
 *
 * Perf tip: to avoid the extra Clerk API round-trip on every request,
 * configure a Clerk JWT template that includes `public_metadata` as a
 * session claim, then read `getAuth(req).sessionClaims.publicMetadata`
 * instead of calling `clerkClient.users.getUser`.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const { userId } = getAuth(req);

  if (!userId) {
    throw ApiError.unauthorized('Authentication required');
  }

  const clerkUser = await clerkClient.users.getUser(userId);
  const role = clerkUser.publicMetadata?.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';

  let user = await prisma.user.findUnique({ where: { clerkId: userId } });

  if (!user) {
    // Normally the Clerk webhook (user.created) creates this row. This is
    // just a fallback in case the request beats the webhook, or the
    // webhook was missed.
    user = await prisma.user.create({
      data: {
        clerkId: userId,
        email: clerkUser.emailAddresses?.[0]?.emailAddress || `${userId}@unknown.local`,
        name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || 'New User',
        phone: clerkUser.phoneNumbers?.[0]?.phoneNumber || null,
        role,
      },
    });
    await prisma.cart.create({ data: { userId: user.id } }).catch(() => {});
  } else if (user.role !== role) {
    // Keep the local cache in sync if metadata changed since the last webhook.
    user = await prisma.user.update({ where: { id: user.id }, data: { role } });
  }

  req.user = {
    id: user.id,
    clerkId: user.clerkId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
  };

  next();
});

/**
 * Restricts access to the given roles. Use after `authenticate`.
 * Usage: authorize('ADMIN') or authorize('ADMIN', 'CUSTOMER')
 */
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };

module.exports = { withClerk, authenticate, authorize };
