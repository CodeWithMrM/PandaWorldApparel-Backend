const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const paymentService = require('../services/payment.service');
const env = require('../config/env');

// POST /api/payments/payfast  { orderId }
// Returns the PayFast process URL + signed form fields. The frontend should
// auto-submit these as a POST form to `processUrl` to redirect the
// customer into PayFast's hosted checkout.
const createPayfastSession = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) throw ApiError.badRequest('orderId is required');

  const session = await paymentService.createPaymentSession(req.user.id, orderId);
  return new ApiResponse(200, session, 'PayFast payment session created').send(res);
});

// POST /api/payments/notify — PayFast server-to-server ITN webhook.
// Must always respond quickly with 200 or PayFast will retry.
const handleNotify = asyncHandler(async (req, res) => {
  try {
    await paymentService.handleItn(req.body);
  } catch (err) {
    // Log but still acknowledge receipt so PayFast doesn't hammer retries
    // for a payload we've deliberately rejected (e.g. bad signature).
    // eslint-disable-next-line no-console
    console.error('[payfast:itn] rejected notification:', err.message);
  }
  res.status(200).send('OK');
});

// GET /api/payments/success — browser return_url after a successful payment.
// The ITN webhook is the source of truth for payment status; this just
// sends the shopper back to the storefront.
const handleSuccess = asyncHandler(async (req, res) => {
  const orderId = req.query.m_payment_id || req.query.orderId;
  res.redirect(`${env.clientUrl}/checkout/success${orderId ? `?orderId=${orderId}` : ''}`);
});

// GET /api/payments/cancel — browser cancel_url
const handleCancel = asyncHandler(async (req, res) => {
  const orderId = req.query.m_payment_id || req.query.orderId;
  res.redirect(`${env.clientUrl}/checkout/cancelled${orderId ? `?orderId=${orderId}` : ''}`);
});

module.exports = { createPayfastSession, handleNotify, handleSuccess, handleCancel };
