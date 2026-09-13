const express = require('express');
const imagekitController = require('../controllers/imagekit.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');

const router = express.Router();

router.get('/auth', authenticate, authorize('ADMIN'), writeLimiter, imagekitController.getUploadAuthentication);

module.exports = router;
