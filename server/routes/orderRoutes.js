import express from "express";
import { protectSeller } from "../middleware/authMiddleware.js";
import {
  getSellerOrders,
  updateOrderStatus
} from "../controllers/orderController.js";

const router = express.Router();

// GET /api/seller/orders
router.get("/", protectSeller, getSellerOrders);

// PUT /api/seller/orders/:id/status
router.put("/:id/status", protectSeller, updateOrderStatus);

export default router;