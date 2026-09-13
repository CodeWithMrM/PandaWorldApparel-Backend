const { clerkMiddleware, getAuth, clerkClient } = require("@clerk/express");

const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const prisma = require("../config/prisma");

/**
 * Clerk middleware.
 *
 * This should be mounted globally in app.js BEFORE your API routes:
 *
 * app.use(withClerk);
 * app.use('/api', routes);
 *
 * It reads the Clerk Bearer token from the request and
 * makes the authentication state available through getAuth(req).
 */
const withClerk = clerkMiddleware();

/**
 * Authenticate the current request.
 *
 * Authentication flow:
 *
 * Browser
 *   ↓
 * Clerk session token
 *   ↓
 * Authorization: Bearer <token>
 *   ↓
 * Clerk middleware
 *   ↓
 * getAuth(req)
 *   ↓
 * Clerk user
 *   ↓
 * Prisma User
 *   ↓
 * req.user
 */
const authenticate = asyncHandler(async (req, res, next) => {
  console.log("");
  console.log("========== PANDAWORLD AUTH ==========");

  /*
   * Never log the actual Authorization header/token.
   * We only check whether it exists.
   */
  console.log(
    "Authorization header:",
    req.headers.authorization ? "PRESENT" : "MISSING",
  );

  /*
   * Get Clerk authentication state.
   */
  let auth;

  try {
    auth = getAuth(req);

    console.log("Clerk authentication:", {
      userId: auth.userId || null,
      sessionId: auth.sessionId || null,
      isAuthenticated: auth.isAuthenticated,
    });
  } catch (error) {
    console.error("CLERK getAuth() FAILED:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    throw ApiError.unauthorized("Unable to authenticate with Clerk");
  }

  const { userId } = auth;

  /*
   * No Clerk user means the request is not authenticated.
   */
  if (!userId) {
    console.error("AUTHENTICATION FAILED: Clerk did not provide a userId");

    throw ApiError.unauthorized("Authentication required");
  }

  console.log("Clerk user ID:", userId);

  /*
   * Retrieve the user directly from Clerk.
   *
   * This is important because publicMetadata.role is
   * being used as the authoritative role.
   */
  let clerkUser;

  try {
    clerkUser = await clerkClient.users.getUser(userId);

    console.log("Clerk user retrieved:", {
      id: clerkUser.id,
      email: clerkUser.emailAddresses?.[0]?.emailAddress || null,
      firstName: clerkUser.firstName || null,
      lastName: clerkUser.lastName || null,
      publicMetadata: clerkUser.publicMetadata || {},
    });
  } catch (error) {
    console.error("CLERK getUser() FAILED:", {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status,
      stack: error.stack,
    });

    throw ApiError.unauthorized("Unable to retrieve Clerk user");
  }

  /*
   * Resolve the application role.
   *
   * Clerk:
   *
   * publicMetadata:
   * {
   *   role: "ADMIN"
   * }
   *
   * becomes:
   *
   * ADMIN
   *
   * Anything other than ADMIN becomes CUSTOMER.
   */
  const clerkRole = clerkUser.publicMetadata?.role;

  const role = clerkRole === "ADMIN" ? "ADMIN" : "CUSTOMER";

  console.log("Role resolution:", {
    clerkRole,
    resolvedRole: role,
  });

  /*
   * Find the corresponding Prisma user.
   */
  let user;

  try {
    console.log("Looking up Prisma user with clerkId:", userId);

    user = await prisma.user.findUnique({
      where: {
        clerkId: userId,
      },
    });

    console.log(
      "Prisma user lookup:",
      user
        ? {
            id: user.id,
            clerkId: user.clerkId,
            email: user.email,
            role: user.role,
          }
        : "USER NOT FOUND",
    );
  } catch (error) {
    console.error("");
    console.error("========== PRISMA findUnique FAILED ==========");
    console.error({
      name: error.name,
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    });
    console.error("==============================================");

    throw ApiError.badRequest("Database request error");
  }

  /*
   * If the Clerk user exists but the Prisma user does not,
   * create the Prisma user as a safety net.
   *
   * Normally your Clerk webhook should create this row.
   */
  if (!user) {
    const email =
      clerkUser.emailAddresses?.[0]?.emailAddress || `${userId}@unknown.local`;

    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      "New User";

    try {
      console.log("");
      console.log("========== CREATING PRISMA USER ==========");

      console.log({
        clerkId: userId,
        email,
        name,
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

      console.log("Prisma user created:", {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        role: user.role,
      });

      console.log("==========================================");
    } catch (error) {
      console.error("");
      console.error("========== PRISMA user.create FAILED ==========");

      console.error({
        name: error.name,
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack,
      });

      console.error("================================================");

      throw ApiError.badRequest("Database request error");
    }

    /*
     * Create the user's cart.
     *
     * A cart failure should NOT prevent authentication,
     * so this operation is intentionally non-fatal.
     */
    try {
      console.log("Creating cart for Prisma user:", user.id);

      await prisma.cart.create({
        data: {
          userId: user.id,
        },
      });

      console.log("Cart created successfully");
    } catch (error) {
      console.warn("");
      console.warn("========== PRISMA cart.create FAILED ==========");

      console.warn({
        name: error.name,
        message: error.message,
        code: error.code,
        meta: error.meta,
      });

      console.warn("Cart creation failed, but authentication will continue.");

      console.warn("================================================");
    }
  }

  /*
   * Keep Prisma's role synchronized with Clerk.
   *
   * Clerk publicMetadata is the source of truth.
   */
  if (user.role !== role) {
    try {
      console.log("");
      console.log("========== SYNCHRONIZING USER ROLE ==========");

      console.log({
        prismaUserId: user.id,
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

      console.log("Prisma role synchronized:", user.role);

      console.log("=============================================");
    } catch (error) {
      console.error("");
      console.error("========== PRISMA user.update FAILED ==========");

      console.error({
        name: error.name,
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack,
      });

      console.error("================================================");

      throw ApiError.badRequest("Database request error");
    }
  }

  /*
   * Normalize the Prisma user into req.user.
   *
   * Controllers can now use:
   *
   * req.user.id
   * req.user.clerkId
   * req.user.email
   * req.user.role
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

  console.log("");
  console.log("========== PANDAWORLD USER ==========");

  console.log({
    id: req.user.id,
    clerkId: req.user.clerkId,
    email: req.user.email,
    role: req.user.role,
  });

  console.log("======================================");
  console.log("");

  /*
   * Authentication successful.
   */
  next();
});

/**
 * Authorize one or more application roles.
 *
 * Example:
 *
 * router.get(
 *   '/users',
 *   authenticate,
 *   authorize('ADMIN'),
 *   controller
 * );
 *
 * Multiple roles:
 *
 * authorize('ADMIN', 'CUSTOMER')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    /*
     * authenticate() must run before authorize().
     */
    if (!req.user) {
      return next(ApiError.unauthorized("Authentication required"));
    }

    /*
     * Check whether the authenticated user's
     * role is allowed.
     */
    if (!roles.includes(req.user.role)) {
      console.warn("Authorization denied:", {
        userId: req.user.id,
        clerkId: req.user.clerkId,
        role: req.user.role,
        requiredRoles: roles,
      });

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
