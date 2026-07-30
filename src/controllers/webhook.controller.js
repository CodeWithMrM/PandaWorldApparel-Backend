const { Webhook } = require('svix');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../config/prisma');

function resolveRole(publicMetadata) {
  return publicMetadata?.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';
}

function resolveName(data) {
  return [data.first_name, data.last_name].filter(Boolean).join(' ') || 'New User';
}

/**
 * POST /api/webhooks/clerk
 *
 * Verifies the Svix signature Clerk attaches to every webhook delivery,
 * then keeps the local `User` (and their `Cart`) row in sync with Clerk,
 * which remains the source of truth for identity, credentials, and role
 * (stored in `publicMetadata.role`).
 *
 * IMPORTANT: this route is mounted with `express.raw()` in app.js — Svix
 * needs the exact raw request body (not a parsed JSON object) to verify
 * the signature.
 */
const handleClerkWebhook = asyncHandler(async (req, res) => {
  const svixId = req.headers['svix-id'];
  const svixTimestamp = req.headers['svix-timestamp'];
  const svixSignature = req.headers['svix-signature'];

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw ApiError.badRequest('Missing Svix headers');
  }

  const wh = new Webhook(env.clerk.webhookSecret);

  let event;
  try {
    event = wh.verify(req.body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
  } catch (err) {
    throw ApiError.badRequest('Invalid webhook signature');
  }

  const { type, data } = event;

  switch (type) {
    case 'user.created': {
      const user = await prisma.user.upsert({
        where: { clerkId: data.id },
        update: {
          email: data.email_addresses?.[0]?.email_address,
          name: resolveName(data),
          phone: data.phone_numbers?.[0]?.phone_number || null,
          role: resolveRole(data.public_metadata),
        },
        create: {
          clerkId: data.id,
          email: data.email_addresses?.[0]?.email_address,
          name: resolveName(data),
          phone: data.phone_numbers?.[0]?.phone_number || null,
          role: resolveRole(data.public_metadata),
        },
      });

      await prisma.cart.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });
      break;
    }

    case 'user.updated': {
      await prisma.user.updateMany({
        where: { clerkId: data.id },
        data: {
          email: data.email_addresses?.[0]?.email_address,
          name: resolveName(data),
          phone: data.phone_numbers?.[0]?.phone_number || null,
          role: resolveRole(data.public_metadata),
        },
      });
      break;
    }

    case 'user.deleted': {
      // `data.deleted` is true and `data.id` is still the Clerk user id.
      await prisma.user.deleteMany({ where: { clerkId: data.id } });
      break;
    }

    default:
      // Ignore event types we don't care about.
      break;
  }

  // Always acknowledge quickly so Clerk doesn't retry unnecessarily.
  res.status(200).json({ received: true });
});

module.exports = { handleClerkWebhook };
