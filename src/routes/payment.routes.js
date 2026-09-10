const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter, paymentNotifyLimiter } = require('../middleware/rateLimiter.middleware');

// Paystack checkout: customer must be authenticated
router.post('/paystack/checkout', authenticate, writeLimiter, paymentController.createPaystackCheckout);

// Paystack webhook: called directly by Paystack (no auth headers)
router.post('/webhook/paystack', paymentNotifyLimiter, paymentController.handlePaystackWebhook);

// Return URLs after payment
router.get('/success', paymentController.handleSuccess);
router.get('/cancel', paymentController.handleCancel);

module.exports = router;
