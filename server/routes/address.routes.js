const router = require('express').Router();
const addressController = require('../controllers/address.controller');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/', verifyToken, addressController.createAddress);
router.get('/', verifyToken, addressController.getUserAddresses);
router.put('/:id', verifyToken, addressController.updateAddress);
router.delete('/:id', verifyToken, addressController.deleteAddress);

module.exports = router;
