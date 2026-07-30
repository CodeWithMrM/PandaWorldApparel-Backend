const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter, paymentNotifyLimiter } = require('../middleware/rateLimiter.middleware');

// Customer must be authenticated to initiate a payment for their order.
router.post('/payfast', authenticate, writeLimiter, paymentController.createPayfastSession);

// PayFast calls these directly — no auth headers will be present.
router.post('/notify', paymentNotifyLimiter, paymentController.handleNotify);
router.get('/success', paymentController.handleSuccess);
router.get('/cancel', paymentController.handleCancel);

module.exports = router;
