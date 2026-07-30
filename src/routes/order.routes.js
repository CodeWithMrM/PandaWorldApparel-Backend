const express = require('express');
const router = express.Router();

const orderController = require('../controllers/order.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const {
  createOrderValidator,
  updateOrderStatusValidator,
} = require('../validators/order.validator');

router.use(authenticate);

router.post('/', writeLimiter, validate(createOrderValidator), orderController.createOrder);
router.get('/', orderController.getOrders); // customer: own orders, admin: all orders
router.get('/:id', orderController.getOrder);

// Admin only
router.patch(
  '/:id/status',
  authorize('ADMIN'),
  validate(updateOrderStatusValidator),
  orderController.updateOrderStatus
);

module.exports = router;
