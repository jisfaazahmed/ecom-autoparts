const Address = require('../models/address.model');

exports.createAddress = async (req, res) => {
    try {
        const address = new Address({
            ...req.body,
            user: req.user.id // Assuming verifyToken sets req.user
        });
        await address.save();
        res.status(201).json({ message: 'Address created successfully', address });
    } catch (error) {
        res.status(500).json({ message: 'Error creating address', error: error.message });
    }
};

exports.getUserAddresses = async (req, res) => {
    try {
        const addresses = await Address.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(addresses);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching addresses', error: error.message });
    }
};

exports.updateAddress = async (req, res) => {
    try {
        const address = await Address.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            req.body,
            { new: true, runValidators: true }
        );

        if (!address) {
            return res.status(404).json({ message: 'Address not found' });
        }

        // If this update sets it to default, the pre-save hook on mongoose doesn't trigger for findOneAndUpdate by default.
        // So we need to handle it manually if they set default to true
        if (req.body.isDefaultShipping) {
            await Address.updateMany(
                { user: req.user.id, _id: { $ne: address._id } },
                { isDefaultShipping: false }
            );
        }
        if (req.body.isDefaultBilling) {
            await Address.updateMany(
                { user: req.user.id, _id: { $ne: address._id } },
                { isDefaultBilling: false }
            );
        }

        res.status(200).json({ message: 'Address updated', address });
    } catch (error) {
        res.status(500).json({ message: 'Error updating address', error: error.message });
    }
};

exports.deleteAddress = async (req, res) => {
    try {
        const address = await Address.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        if (!address) {
            return res.status(404).json({ message: 'Address not found' });
        }
        res.status(200).json({ message: 'Address deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting address', error: error.message });
    }
};
