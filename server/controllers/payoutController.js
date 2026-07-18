import Payout from "../models/Payout.js";

export const getPayouts = async (req, res) => {
  try {
    const payouts = await Payout.find({ seller: req.seller._id });
    res.json(payouts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createPayout = async (req, res) => {
  try {
    const { amount } = req.body;
    const payout = await Payout.create({
      seller: req.seller._id,
      amount,
      status: "PENDING"
    });
    res.status(201).json(payout);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};