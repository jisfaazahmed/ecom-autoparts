import express from "express";
import { protectSeller } from "../middleware/authMiddleware.js";
import {
  getInventory,
  updateInventoryForProduct
} from "../controllers/inventoryController.js";

const router = express.Router();

// GET /api/seller/inventory
router.get("/", protectSeller, getInventory);

// PUT /api/seller/inventory/:productId
router.put("/:productId", protectSeller, updateInventoryForProduct);

export default router;