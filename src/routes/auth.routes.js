const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Registration and login happen via Clerk on the frontend (hosted
// components / Clerk SDK). This backend only verifies the resulting
// session token, so there is no /register or /login endpoint here.
router.get('/me', authenticate, authController.getMe);

module.exports = router;
