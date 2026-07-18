import express from "express";
import { protectSeller } from "../middleware/authMiddleware.js";
import {
  getSellerSettings,
  updateSellerSettings
} from "../controllers/sellerSettingsController.js";

const router = express.Router();

// GET /api/seller/settings
router.get("/", protectSeller, getSellerSettings);

// PUT /api/seller/settings
router.put("/", protectSeller, updateSellerSettings);

export default router;