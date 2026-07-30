const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const authService = require('../services/auth.service');

// GET /api/auth/me — Clerk handles registration/login on the frontend;
// this just returns the local, webhook-synced profile for the caller.
const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  return new ApiResponse(200, user, 'Current user fetched').send(res);
});

module.exports = { getMe };
