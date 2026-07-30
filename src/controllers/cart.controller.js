const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const cartService = require('../services/cart.service');

const getCart = asyncHandler(async (req, res) => {
  const cart = await cartService.getCart(req.user.id);
  return new ApiResponse(200, cart, 'Cart fetched').send(res);
});

const addItem = asyncHandler(async (req, res) => {
  const cart = await cartService.addItem(req.user.id, req.body);
  return new ApiResponse(201, cart, 'Item added to cart').send(res);
});

const updateItem = asyncHandler(async (req, res) => {
  const cart = await cartService.updateItem(req.user.id, req.params.id, req.body.quantity);
  return new ApiResponse(200, cart, 'Cart item updated').send(res);
});

const removeItem = asyncHandler(async (req, res) => {
  const cart = await cartService.removeItem(req.user.id, req.params.id);
  return new ApiResponse(200, cart, 'Cart item removed').send(res);
});

const clearCart = asyncHandler(async (req, res) => {
  const cart = await cartService.clearCart(req.user.id);
  return new ApiResponse(200, cart, 'Cart cleared').send(res);
});

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };
