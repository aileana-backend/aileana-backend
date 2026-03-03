const express = require("express");
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductsByStore,
  getProductsByCategory,
  searchProducts,
  toggleProductStatus,
  getActiveProducts,
} = require("../controllers/productController");
const { auth } = require("../middleware/auth");

const router = express.Router();

// Protected (store owner only)
router.post("/product", auth, createProduct);
router.patch("/product/:id", auth, updateProduct);
router.delete("/product/:id", auth, deleteProduct);

// Public
router.get("/product", getProducts);
router.get("/active", getActiveProducts);
router.get("/product/:id", getProductById);
router.get("/store/:storeId", getProductsByStore);
router.get("/category/:categoryId", getProductsByCategory);
router.get("/search", searchProducts);

// Toggle product status
router.patch("/:id/toggle", auth, toggleProductStatus);

module.exports = router;
