const Product = require("../models/Product");
const Store = require("../models/Store");
const Category = require("../models/Category");

// Create product (store owner only)
const createProduct = async (req, res) => {
  try {
    const { category, name, description, price, stock, images } = req.body;
    const userId = req.user._id;

    // find store owned by this user
    const store = await Store.findOne({ owner: userId });
    if (!store) {
      return res.status(403).json({ msg: "You don't own a store." });
    }

    // validate category
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({ msg: "Category does not exist" });
    }

    const product = new Product({
      store: store._id,
      category,
      name,
      description,
      price,
      stock,
      images,
    });

    await product.save();

    // link product to store
    store.products.push(product._id);
    await store.save();

    res.status(201).json(product);
  } catch (err) {
    console.error("Create product error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Update product (store owner only)
const updateProduct = async (req, res) => {
  try {
    const userId = req.user._id;
    const product = await Product.findById(req.params.id);

    if (!product) return res.status(404).json({ msg: "Product not found" });

    // ensure product belongs to a store owned by this user
    const store = await Store.findById(product.store);
    if (!store || store.owner.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ msg: "Not authorized to update this product" });
    }

    Object.assign(product, req.body);
    await product.save();

    res.json(product);
  } catch (err) {
    console.error("Update product error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Delete product (store owner only)
const deleteProduct = async (req, res) => {
  try {
    const userId = req.user._id;
    const product = await Product.findById(req.params.id);

    if (!product) return res.status(404).json({ msg: "Product not found" });

    const store = await Store.findById(product.store);
    if (!store || store.owner.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ msg: "Not authorized to delete this product" });
    }

    await Product.findByIdAndDelete(product._id);
    await Store.findByIdAndUpdate(product.store, {
      $pull: { products: product._id },
    });

    res.json({ msg: "Product deleted successfully" });
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Public: Get all products
const getProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("store", "name")
      .populate("category", "name");
    res.json(products);
  } catch (err) {
    console.error("Get products error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Public: Get single product
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("store", "name")
      .populate("category", "name");

    if (!product) return res.status(404).json({ msg: "Product not found" });

    res.json(product);
  } catch (err) {
    console.error("Get product error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
