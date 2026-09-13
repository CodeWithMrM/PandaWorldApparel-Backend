const { clerkMiddleware, getAuth, clerkClient } = require("@clerk/express");

const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const prisma = require("../config/prisma");

/**
 * Clerk middleware.
 *
 * Mount this globally in app.js BEFORE your API routes:
 *
 * app.use(withClerk);
 * app.use('/api', routes);
 */
const withClerk = clerkMiddleware();

/**
 * Authenticate the current request.
 *
 * Flow:
 *
 * 1. Clerk middleware reads the Authorization: Bearer <token>
 * 2. getAuth(req) extracts the authenticated Clerk user
 * 3. We retrieve the Clerk user from Clerk's backend API
 * 4. publicMetadata.role is used as the authoritative role
 * 5. We find/create the corresponding Prisma User
 * 6. req.user is populated for the rest of the application
 */
const authenticate = asyncHandler(async (req, res, next) => {
  console.log("========== PANDAWORLD AUTH ==========");

  // Debug only — NEVER log the actual token.
  console.log(
    "Authorization header:",
    req.headers.authorization ? "PRESENT" : "MISSING",
  );

  const auth = getAuth(req);

  console.log("Clerk auth state:", {
    userId: auth.userId || null,
    sessionId: auth.sessionId || null,
    isAuthenticated: auth.isAuthenticated,
  });

  console.log("=====================================");

  const { userId } = auth;

  if (!userId) {
    throw ApiError.unauthorized("Authentication required");
  }

  // Retrieve the authoritative user from Clerk.
  const clerkUser = await clerkClient.users.getUser(userId);

  if (!clerkUser) {
    throw ApiError.unauthorized("Clerk user could not be found");
  }

  /**
   * Clerk Public Metadata
   *
   * Expected:
   *
   * {
   *   "role": "ADMIN"
   * }
   */
  const clerkRole = clerkUser.publicMetadata?.role;

  const role = clerkRole === "ADMIN" ? "ADMIN" : "CUSTOMER";

  console.log("Authenticated Clerk user:", {
    userId: clerkUser.id,
    email: clerkUser.emailAddresses?.[0]?.emailAddress,
    clerkRole,
    resolvedRole: role,
  });

  /**
   * Find the corresponding Prisma user.
   */
  let user = await prisma.user.findUnique({
    where: {
      clerkId: userId,
    },
  });

  /**
   * Safety net:
   *
   * Normally your Clerk webhook should create the Prisma user.
   * If the webhook hasn't arrived yet, create the user here.
   */
  if (!user) {
    const email =
      clerkUser.emailAddresses?.[0]?.emailAddress || `${userId}@unknown.local`;

    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      "New User";

    console.log("Creating missing Prisma user:", {
      clerkId: userId,
      email,
      role,
    });

    user = await prisma.user.create({
      data: {
        clerkId: userId,
        email,
        name,
        phone: clerkUser.phoneNumbers?.[0]?.phoneNumber || null,
        role,
      },
    });

    /**
     * Create the user's cart.
     *
     * Cart creation should not make authentication fail,
     * so errors are intentionally ignored.
     */
    await prisma.cart
      .create({
        data: {
          userId: user.id,
        },
      })
      .catch((error) => {
        console.warn("Could not create cart for new user:", error.message);
      });
  }

  /**
   * Keep Prisma's cached role synchronized with Clerk.
   *
   * Clerk is the source of truth.
   */
  if (user.role !== role) {
    console.log("Synchronizing Prisma role:", {
      userId: user.id,
      oldRole: user.role,
      newRole: role,
    });

    user = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        role,
      },
    });
  }

  /**
   * Normalize the user object exposed to the rest
   * of the Express application.
   */
  req.user = {
    id: user.id,
    clerkId: user.clerkId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
  };

  console.log("PandaWorld authenticated user:", {
    id: req.user.id,
    clerkId: req.user.clerkId,
    email: req.user.email,
    role: req.user.role,
  });

  next();
});

/**
 * Restrict a route to one or more roles.
 *
 * Examples:
 *
 * authorize('ADMIN')
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
