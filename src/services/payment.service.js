const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const orderService = require('./order.service');
const {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
} = require('../utils/paystack.util');

/**
 * Initialize a Paystack transaction for an order.
 * Returns the authorization URL and access code needed for checkout.
 */
async function createPaystackCheckout(userId, orderId) {
  const order = await orderService.getOrderById(orderId, userId);

  if (order.paymentStatus === 'PAID') {
    throw ApiError.badRequest('This order has already been paid for');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  const transactionData = await initializeTransaction({
    orderId,
    amount: Number(order.total),
    userEmail: user.email,
    userName: user.name,
  });

  // Return authorization URL and access code for frontend redirect
  return {
    authorizationUrl: transactionData.authorization_url,
    accessCode: transactionData.access_code,
    reference: transactionData.reference,
  };
}

/**
 * Handles Paystack webhook verification.
 * Paystack calls this endpoint when a payment is successful.
 * This is the source of truth for updating order.paymentStatus.
 */
async function handleWebhook(body, signature) {
  // Verify webhook signature
  const isValidSignature = verifyWebhookSignature(JSON.stringify(body), signature);
  if (!isValidSignature) {
    throw ApiError.badRequest('Invalid Paystack webhook signature');
  }

  // Only process successful charge events
  if (body.event !== 'charge.success') {
    return { message: 'Event not processed', event: body.event };
  }

  const { data } = body;
  const orderId = data.metadata.orderId;
  const reference = data.reference;

  if (!orderId) {
    throw ApiError.badRequest('Missing orderId in webhook metadata');
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw ApiError.notFound('Order referenced in webhook not found');
  }

  // Verify transaction with Paystack API as final confirmation
  const transaction = await verifyTransaction(reference);

  if (transaction.status === 'success') {
    await orderService.updatePaymentStatus(orderId, 'PAID', reference);
    return { orderId, paymentStatus: 'PAID' };
  } else {
    await orderService.updatePaymentStatus(orderId, 'FAILED', reference);
    return { orderId, paymentStatus: 'FAILED' };
  }
}

module.exports = { createPaystackCheckout, handleWebhook };
