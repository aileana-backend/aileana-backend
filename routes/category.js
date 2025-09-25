const express = require("express");
const router = express.Router();
const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
} = require("../controllers/categoryController");

const { auth } = require("../middleware/auth");

router.get("/category", getCategories);
router.get("/category::id", getCategoryById);

router.post("/category", auth, createCategory);
router.put("/category/:id", auth, updateCategory);
router.patch("/category/:id/status", auth, toggleCategoryStatus);
router.delete("/category/:id", auth, deleteCategory);

module.exports = router;
