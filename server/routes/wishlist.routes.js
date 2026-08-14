const router = require('express').Router();
const ctrl = require('../controllers/wishlist.controller');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', ctrl.getWishlist);
router.get('/ids', ctrl.getWishlistIds);
router.post('/:productId', ctrl.addToWishlist);
router.delete('/:productId', ctrl.removeFromWishlist);

module.exports = router;
