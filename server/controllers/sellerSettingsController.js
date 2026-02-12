import Seller from "../models/Seller.js";

export const getSellerSettings = async (req, res) => {
  res.json({
    shopName: req.seller.shopName,
    shopDescription: req.seller.shopDescription,
    shippingSettings: req.seller.shippingSettings
  });
};

export const updateSellerSettings = async (req, res) => {
  try {
    const { shopName, shopDescription, shippingSettings } = req.body;
    const updated = await Seller.findByIdAndUpdate(
      req.seller._id,
      { shopName, shopDescription, shippingSettings },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};