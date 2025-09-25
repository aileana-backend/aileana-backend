const Store = require("../models/Store");
const User = require("../models/User");

// Get logged-in user's store
const getMyStore = async (req, res) => {
  try {
    const userId = req.user._id;
    const store = await Store.findOne({ owner: userId })
      .populate("categories")
      .populate("products");

    if (!store) return res.status(404).json({ msg: "Store not found" });

    res.json(store);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

const updateStore = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, description, logo, categories } = req.body;

    const store = await Store.findOneAndUpdate(
      { owner: userId },
      { name, description, logo, categories },
      { new: true }
    );

    if (!store) return res.status(404).json({ msg: "Store not found" });

    res.json({ msg: "Store updated successfully", store });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Activate or Deactivate store
const toggleStoreStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { isActive } = req.body;

    const store = await Store.findOneAndUpdate(
      { owner: userId },
      { isActive },
      { new: true }
    );

    if (!store) return res.status(404).json({ msg: "Store not found" });

    res.json({
      msg: `Store ${isActive ? "activated" : "deactivated"} successfully`,
      store,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

const getAllStores = async (req, res) => {
  try {
    const stores = await Store.find().populate(
      "owner",
      "first_name last_name email"
    );
    res.json(stores);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

module.exports = {
  getMyStore,
  updateStore,
  toggleStoreStatus,
  getAllStores,
};
