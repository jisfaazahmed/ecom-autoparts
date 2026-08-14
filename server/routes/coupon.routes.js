const router = require('express').Router();
const couponController = require('../controllers/coupon.controller');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

// Public: checkout coupon validation (guest and logged-in users)
router.post('/validate', couponController.validateCoupon);
router.get('/public/active', couponController.getPublicActiveCoupons);

// Super Admin: coupon management
router.get('/', verifyToken, isSuperAdmin, couponController.getCoupons);
router.get('/:id', verifyToken, isSuperAdmin, couponController.getCoupon);
router.post('/', verifyToken, isSuperAdmin, couponController.createCoupon);
router.put('/:id', verifyToken, isSuperAdmin, couponController.updateCoupon);
router.delete('/:id', verifyToken, isSuperAdmin, couponController.deleteCoupon);

module.exports = router;
