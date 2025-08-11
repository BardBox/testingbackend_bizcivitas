import express from "express";
import {
  getAllCategories,
  getSubcategoriesByCategory,
} from "../controllers/categoryController.js";

const router = express.Router();

router.get("/categories", getAllCategories);
router.get("/subcategories/:category", getSubcategoriesByCategory);

export default router;
