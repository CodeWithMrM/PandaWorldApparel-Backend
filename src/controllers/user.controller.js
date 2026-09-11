const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const userService = require('../services/user.service');

const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.user.id);
  return new ApiResponse(200, user, 'Profile fetched').send(res);
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  return new ApiResponse(200, user, 'Profile updated').send(res);
});

// Admin only
const listUsers = asyncHandler(async (req, res) => {
  const { users, meta } = await userService.listUsers(req.query);
  return new ApiResponse(200, users, 'Users fetched', meta).send(res);
});

// Admin only
const deleteUser = asyncHandler(async (req, res) => {
  await userService.deleteUser(req.params.id, req.user.id);
  return new ApiResponse(200, null, 'User deleted successfully').send(res);
});

// Admin only: update user role
const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  const user = await userService.updateUserRole(req.params.id, role);
  return new ApiResponse(200, user, 'User role updated successfully').send(res);
});

module.exports = { getProfile, updateProfile, listUsers, deleteUser, updateUserRole };
