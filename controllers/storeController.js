<<<<<<< HEAD
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
=======
const knex = require("../config/pg");

const getMyStore = async (req, res) => {
  try {
    const store = await knex("stores").where({ owner_id: req.user.id }).first();

    if (!store)
      return res.status(404).json({ success: false, msg: "Store not found" });

    const categories = await knex("store_categories").where({
      store_id: store.id,
    });
    const products = await knex("products").where({ store_id: store.id });

    return res.json({
      success: true,
      data: { ...store, categories, products },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, msg: "Server error" });
>>>>>>> payment
  }
};

const updateStore = async (req, res) => {
  try {
<<<<<<< HEAD
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
=======
    const { name, description, logo, categories } = req.body;

    const [store] = await knex("stores")
      .where({ owner_id: req.user.id })
      .update({ name, description, logo, updated_at: new Date() })
      .returning("*");

    if (!store)
      return res.status(404).json({ success: false, msg: "Store not found" });

    // Update categories if provided
    if (categories && categories.length > 0) {
      await knex("store_categories").where({ store_id: store.id }).delete();
      await knex("store_categories").insert(
        categories.map((name) => ({ store_id: store.id, name })),
      );
    }

    return res.json({
      success: true,
      msg: "Store updated successfully",
      data: store,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

const toggleStoreStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const [store] = await knex("stores")
      .where({ owner_id: req.user.id })
      .update({ is_active: isActive, updated_at: new Date() })
      .returning("*");

    if (!store)
      return res.status(404).json({ success: false, msg: "Store not found" });

    return res.json({
      success: true,
      msg: `Store ${isActive ? "activated" : "deactivated"} successfully`,
      data: store,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, msg: "Server error" });
>>>>>>> payment
  }
};

const getAllStores = async (req, res) => {
  try {
<<<<<<< HEAD
    const stores = await Store.find().populate(
      "owner",
      "first_name last_name email"
    );
    res.json(stores);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
=======
    const stores = await knex("stores")
      .join("users", "stores.owner_id", "users.id")
      .select("stores.*", "users.first_name", "users.last_name", "users.email");

    return res.json({ success: true, data: stores });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, msg: "Server error" });
>>>>>>> payment
  }
};

module.exports = {
  getMyStore,
  updateStore,
  toggleStoreStatus,
  getAllStores,
};
