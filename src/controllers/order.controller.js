const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const orderService = require('../services/order.service');

// POST /api/orders — create order from the authenticated user's cart
const createOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createOrderFromCart(req.user.id, req.body);
  return new ApiResponse(201, order, 'Order created successfully').send(res);
});

// GET /api/orders — customer: own orders, admin: all orders
const getOrders = asyncHandler(async (req, res) => {
  if (req.user.role === 'ADMIN') {
    const { orders, meta } = await orderService.getAllOrders(req.query);
    return new ApiResponse(200, orders, 'All orders fetched', meta).send(res);
  }
  const { orders, meta } = await orderService.getUserOrders(req.user.id, req.query);
  return new ApiResponse(200, orders, 'Your orders fetched', meta).send(res);
});

// GET /api/orders/:id
const getOrder = asyncHandler(async (req, res) => {
  const scopedUserId = req.user.role === 'ADMIN' ? null : req.user.id;
  const order = await orderService.getOrderById(req.params.id, scopedUserId);
  return new ApiResponse(200, order, 'Order fetched').send(res);
});

// PATCH /api/orders/:id/status — admin only
const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await orderService.updateOrderStatus(req.params.id, req.body.status);
  return new ApiResponse(200, order, 'Order status updated').send(res);
});

module.exports = { createOrder, getOrders, getOrder, updateOrderStatus };
