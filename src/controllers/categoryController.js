import categories from "../models/category.model.js";

export const getAllCategories = (req, res) => {
  const categoryNames = categories.map((item) => item.category);
  res.json(categoryNames);
};

export const getSubcategoriesByCategory = (req, res) => {
  const { category } = req.params;

  const match = categories.find((item) => item.category === category);

  if (match) {
    res.json(match.subcategories);
  } else {
    res.status(404).json({ message: "Category not found" });
  }
};
