import express from "express";
import { protectSeller } from "../middleware/authMiddleware.js";
import {
  getPayouts,
  createPayout
} from "../controllers/payoutController.js";

const router = express.Router();

// GET /api/seller/payouts
router.get("/", protectSeller, getPayouts);

// POST /api/seller/payouts
router.post("/", protectSeller, createPayout);

export default router;