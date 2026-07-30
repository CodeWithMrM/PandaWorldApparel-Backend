const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const orderService = require('./order.service');
const {
  buildPaymentPayload,
  getPayfastProcessUrl,
  verifyItnSignature,
} = require('../utils/payfast.util');

/**
 * Builds the PayFast payment fields + target URL for a given order.
 * The client is expected to auto-submit these fields as a POST form to
 * `processUrl` (standard PayFast "onsite"/redirect flow).
 */
async function createPaymentSession(userId, orderId) {
  const order = await orderService.getOrderById(orderId, userId);

  if (order.paymentStatus === 'PAID') {
    throw ApiError.badRequest('This order has already been paid for');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  const fields = buildPaymentPayload({ order, user });
  const processUrl = getPayfastProcessUrl();

  return { fields, processUrl };
}

/**
 * Handles PayFast's server-to-server Instant Transaction Notification (ITN).
 * PayFast calls this endpoint directly (not the user's browser) once a
 * payment's status changes, so this is the source of truth for updating
 * order.paymentStatus — never trust the browser return_url alone.
 */
async function handleItn(body) {
  const isValidSignature = verifyItnSignature(body);
  if (!isValidSignature) {
    throw ApiError.badRequest('Invalid PayFast signature');
  }

  const orderId = body.m_payment_id;
  const paymentStatus = body.payment_status; // 'COMPLETE', 'FAILED', etc.
  const pfPaymentId = body.pf_payment_id;

  if (!orderId) {
    throw ApiError.badRequest('Missing m_payment_id in ITN payload');
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw ApiError.notFound('Order referenced in ITN not found');
  }

  if (paymentStatus === 'COMPLETE') {
    await orderService.updatePaymentStatus(orderId, 'PAID', pfPaymentId);
  } else {
    await orderService.updatePaymentStatus(orderId, 'FAILED', pfPaymentId);
  }

  return { orderId, paymentStatus };
}

module.exports = { createPaymentSession, handleItn };
