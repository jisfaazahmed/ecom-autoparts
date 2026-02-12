import express from "express";
import { protectSeller } from "../middleware/authMiddleware.js";
import {
  registerSeller,
  loginSeller,
  getCurrentSeller
} from "../controllers/sellerAuthController.js";

const router = express.Router();

// POST /api/seller/auth/register
router.post("/register", registerSeller);

// POST /api/seller/auth/login
router.post("/login", loginSeller);

// GET /api/seller/auth/me
router.get("/me", protectSeller, getCurrentSeller);

export default router;