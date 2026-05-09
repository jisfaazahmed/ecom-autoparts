import express from "express";
import { protectSeller } from "../middleware/authMiddleware.js";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct
} from "../controllers/productController.js";

const router = express.Router();

// POST /api/seller/products
router.post("/", protectSeller, createProduct);

// GET /api/seller/products
router.get("/", protectSeller, getProducts);

// GET /api/seller/products/:id
router.get("/:id", protectSeller, getProductById);

// PUT /api/seller/products/:id
router.put("/:id", protectSeller, updateProduct);

// DELETE /api/seller/products/:id
router.delete("/:id", protectSeller, deleteProduct);

export default router;