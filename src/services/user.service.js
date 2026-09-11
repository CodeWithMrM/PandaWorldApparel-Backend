const { clerkClient } = require('@clerk/express');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { safeUserSelect } = require('./auth.service');
const { getPagination, buildMeta } = require('../utils/pagination');

async function getProfile(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: safeUserSelect });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

/**
 * Updates locally-editable profile fields only. Email, password, and
 * identity are owned by Clerk — change those via Clerk's frontend
 * components/API, and they'll flow back here through the user.updated
 * webhook.
 */
async function updateProfile(userId, { name, phone }) {
  const data = {};
  if (name !== undefined) data.name = name;
  if (phone !== undefined) data.phone = phone;

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: safeUserSelect,
  });
  return user;
}

async function listUsers(query) {
  const { page, limit, skip, take } = getPagination(query);

  const where = {};
  if (query.role) where.role = query.role;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: safeUserSelect,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, meta: buildMeta({ page, limit, total }) };
}

async function deleteUser(userId, requestingUserId) {
  if (userId === requestingUserId) {
    throw ApiError.badRequest('Admins cannot delete their own account via this endpoint');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');

  // Note: this only removes the local record. To fully remove the person's
  // account you should also delete them in Clerk (clerkClient.users.deleteUser),
  // otherwise they could sign back in and get auto-recreated locally.
  await prisma.user.delete({ where: { id: userId } });
}

/**
 * Updates a user's role in Clerk. This triggers the user.updated webhook,
 * which syncs the change to the local database. Only admins can call this.
 */
async function updateUserRole(userId, role) {
  if (!['ADMIN', 'CUSTOMER'].includes(role)) {
    throw ApiError.badRequest('Invalid role. Must be ADMIN or CUSTOMER');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');

  // Update in Clerk (source of truth), which triggers the webhook to sync back
  await clerkClient.users.updateUser(user.clerkId, {
    publicMetadata: { role },
  });

  // Return the updated local user (webhook will sync within seconds)
  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: safeUserSelect,
  });

  return updatedUser;
}

module.exports = { getProfile, updateProfile, listUsers, deleteUser, updateUserRole };
