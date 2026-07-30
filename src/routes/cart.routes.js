const express = require('express');
const router = express.Router();

const cartController = require('../controllers/cart.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { addCartItemValidator, updateCartItemValidator } = require('../validators/cart.validator');

// All cart routes require authentication, and are customer-facing.
router.use(authenticate, authorize('CUSTOMER', 'ADMIN'));

router.get('/', cartController.getCart);
router.post('/items', validate(addCartItemValidator), cartController.addItem);
router.put('/items/:id', validate(updateCartItemValidator), cartController.updateItem);
router.delete('/items/:id', cartController.removeItem);
router.delete('/clear', cartController.clearCart);

module.exports = router;
