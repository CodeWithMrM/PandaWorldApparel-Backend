const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const paymentService = require('../services/payment.service');
const env = require('../config/env');

// POST /api/payments/paystack/checkout — initialize Paystack transaction
// Returns the authorization URL for client redirect
const createPaystackCheckout = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) throw ApiError.badRequest('orderId is required');

  const checkout = await paymentService.createPaystackCheckout(req.user.id, orderId);
  return new ApiResponse(200, checkout, 'Paystack checkout initialized').send(res);
});

// POST /api/payments/webhook/paystack — Paystack webhook
// Called by Paystack after successful payment
const handlePaystackWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  if (!signature) {
    throw ApiError.badRequest('Missing X-Paystack-Signature header');
  }

  try {
    const result = await paymentService.handleWebhook(req.body, signature);
    return new ApiResponse(200, result, 'Webhook processed').send(res);
  } catch (err) {
    // Log but still acknowledge receipt to prevent Paystack retries
    // eslint-disable-next-line no-console
    console.error('[paystack:webhook] rejected notification:', err.message);
    throw err;
  }
});

// GET /api/payments/success — browser return after successful payment
const handleSuccess = asyncHandler(async (req, res) => {
  const { orderId, reference } = req.query;
  res.redirect(
    `${env.clientUrl}/checkout/success${orderId ? `?orderId=${orderId}&reference=${reference}` : ''}`
  );
});

// GET /api/payments/cancel — browser cancel redirect
const handleCancel = asyncHandler(async (req, res) => {
  const { orderId } = req.query;
  res.redirect(`${env.clientUrl}/checkout/cancelled${orderId ? `?orderId=${orderId}` : ''}`);
});

module.exports = { createPaystackCheckout, handlePaystackWebhook, handleSuccess, handleCancel };
