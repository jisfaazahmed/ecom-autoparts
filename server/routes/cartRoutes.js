const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { verifyToken } = require('../middleware/authMiddleware');
const {
	validateCartAdd,
	validateCartUpdate,
	validateObjectIdParam,
} = require('../middleware/requestValidators');

router.use(verifyToken);

router.get('/', cartController.getCart);

router.post('/', validateCartAdd, cartController.addToCart);

router.put('/:productId', validateCartUpdate, cartController.updateCartItem);

router.delete('/:productId', validateObjectIdParam('productId', 'productId'), cartController.removeFromCart);

router.delete('/', cartController.clearCart);

module.exports = router;
