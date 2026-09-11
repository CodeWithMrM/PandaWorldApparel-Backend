const express = require('express');
const router = express.Router();

const userController = require('../controllers/user.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { updateProfileValidator } = require('../validators/user.validator');

router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, validate(updateProfileValidator), userController.updateProfile);

// Admin only
router.get('/', authenticate, authorize('ADMIN'), userController.listUsers);
router.delete('/:id', authenticate, authorize('ADMIN'), userController.deleteUser);
router.patch('/:id/role', authenticate, authorize('ADMIN'), userController.updateUserRole);

module.exports = router;
