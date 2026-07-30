const express = require('express');
const router = express.Router();

const webhookController = require('../controllers/webhook.controller');
const { clerkWebhookLimiter } = require('../middleware/rateLimiter.middleware');

// NOTE: the raw-body parser for this route is applied in app.js, BEFORE
// the global express.json() middleware, because Svix signature
// verification needs the untouched raw request body.
router.post('/clerk', clerkWebhookLimiter, webhookController.handleClerkWebhook);

module.exports = router;
