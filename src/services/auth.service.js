const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const safeUserSelect = {
  id: true,
  clerkId: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * Registration and login are handled entirely by Clerk on the frontend.
 * This service only exposes read access to the local, webhook-synced
 * User record for the already-authenticated caller.
 */
async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: safeUserSelect,
  });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

module.exports = { getCurrentUser, safeUserSelect };
