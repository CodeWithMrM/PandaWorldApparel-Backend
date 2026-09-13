const { clerkMiddleware, getAuth, clerkClient } = require("@clerk/express");

const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const prisma = require("../config/prisma");

/**
 * Clerk global middleware.
 *
 * Mount this before your API routes:
 *
 * app.use(withClerk);
 * app.use('/api', routes);
 */
const withClerk = clerkMiddleware();

/**
 * Require an authenticated Clerk session and resolve
 * the corresponding PandaWorld Prisma user.
 *
 * Clerk publicMetadata.role is the source of truth for
 * the application's ADMIN/CUSTOMER role.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const { userId } = getAuth(req);

  if (!userId) {
    throw ApiError.unauthorized("Authentication required");
  }

  // Get authoritative user data from Clerk.
  const clerkUser = await clerkClient.users.getUser(userId);

  if (!clerkUser) {
    throw ApiError.unauthorized("User not found");
  }

  // Clerk is the source of truth for application role.
  const role =
    clerkUser.publicMetadata?.role === "ADMIN" ? "ADMIN" : "CUSTOMER";

  let user = await prisma.user.findUnique({
    where: {
      clerkId: userId,
    },
  });

  /**
   * Safety net in case the Clerk webhook has not created
   * the Prisma user yet.
   */
  if (!user) {
    const email =
      clerkUser.emailAddresses?.[0]?.emailAddress || `${userId}@unknown.local`;

    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      "New User";

    user = await prisma.user.create({
      data: {
        clerkId: userId,
        email,
        name,
        phone: clerkUser.phoneNumbers?.[0]?.phoneNumber || null,
        role,
      },
    });

    // Cart creation should not prevent authentication.
    await prisma.cart
      .create({
        data: {
          userId: user.id,
        },
      })
      .catch(() => {});
  }

  /**
   * Keep Prisma synchronized with Clerk.
   *
   * This means changing:
   *
   * Clerk publicMetadata.role = "ADMIN"
   *
   * will eventually update:
   *
   * Prisma User.role = "ADMIN"
   */
  if (user.role !== role) {
    user = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        role,
      },
    });
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
 * Restrict access to specific application roles.
 *
 * Example:
 *
 * authorize('ADMIN')
 *
 * or:
 *
 * authorize('ADMIN', 'CUSTOMER')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized("Authentication required"));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden("You do not have permission to perform this action"),
      );
    }

    next();
  };
};

module.exports = {
  withClerk,
  authenticate,
  authorize,
};
