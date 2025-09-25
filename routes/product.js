const express = require("express");
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const { auth } = require("../middleware/auth");

const router = express.Router();

// Public routes
router.get("/product", getProducts);
router.get("/product/:id", getProductById);

// Protected (store owner only)
router.post("/product", auth, createProduct);
router.patch("/product/:id", auth, updateProduct);
router.delete("/product/:id", auth, deleteProduct);

module.exports = router;
