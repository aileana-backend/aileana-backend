const Category = require("../models/Category");

// Create a category
const createCategory = async (req, res) => {
  try {
    const { name, description, parent, icon } = req.body;

    const exists = await Category.findOne({ name });
    if (exists) return res.status(400).json({ msg: "Category already exists" });

    const category = new Category({
      name,
      description,
      parent: parent || null,
      icon,
    });

    await category.save();

    res.status(201).json({ msg: "Category created successfully", category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Get all categories (optionally filter active ones)
const getCategories = async (req, res) => {
  try {
    const { active } = req.query; // ?active=true
    const filter = active ? { isActive: active === "true" } : {};

    const categories = await Category.find(filter)
      .populate("parent", "name _id")
      .sort({ createdAt: -1 });

    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Get single category
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate(
      "parent",
      "name _id"
    );

    if (!category) return res.status(404).json({ msg: "Category not found" });

    res.json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { name, description, parent, icon } = req.body;

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name, description, parent, icon },
      { new: true }
    );

    if (!category) return res.status(404).json({ msg: "Category not found" });

    res.json({ msg: "Category updated successfully", category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Activate/Deactivate category
const toggleCategoryStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    );

    if (!category) return res.status(404).json({ msg: "Category not found" });

    res.json({
      msg: `Category ${isActive ? "activated" : "deactivated"} successfully`,
      category,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ msg: "Category not found" });

    res.json({ msg: "Category deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
};
