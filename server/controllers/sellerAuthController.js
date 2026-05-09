import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Seller from "../models/Seller.js";

export const registerSeller = async (req, res) => {
  try {
    const { name, email, password, shopName } = req.body;
    const exists = await Seller.findOne({ email });
    if (exists) return res.status(400).json({ message: "Seller already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const seller = await Seller.create({
      name,
      email,
      password: hashed,
      shopName
    });

    res.status(201).json({ message: "Seller registered", id: seller._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const loginSeller = async (req, res) => {
  try {
    const { email, password } = req.body;
    const seller = await Seller.findOne({ email });
    if (!seller) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, seller.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: seller._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({
      token,
      seller: {
        id: seller._id,
        name: seller.name,
        email: seller.email,
        shopName: seller.shopName
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getCurrentSeller = (req, res) => {
  res.json(req.seller);
};