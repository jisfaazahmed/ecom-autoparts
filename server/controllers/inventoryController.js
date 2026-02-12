import Inventory from "../models/Inventory.js";
import Product from "../models/ProductSeller.js";

export const getInventory = async (req, res) => {
  try {
    const inventory = await Inventory.find({ seller: req.seller._id }).populate("product");
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateInventoryForProduct = async (req, res) => {
  try {
    const { quantity } = req.body;

    const product = await Product.findOne({
      _id: req.params.productId,
      seller: req.seller._id
    });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const inv = await Inventory.findOneAndUpdate(
      { seller: req.seller._id, product: product._id },
      { quantity },
      { new: true, upsert: true }
    );

    res.json(inv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};