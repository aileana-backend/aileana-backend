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
  }
};

const updateStore = async (req, res) => {
  try {
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
  }
};

const getAllStores = async (req, res) => {
  try {
    const stores = await knex("stores")
      .join("users", "stores.owner_id", "users.id")
      .select("stores.*", "users.first_name", "users.last_name", "users.email");

    return res.json({ success: true, data: stores });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

module.exports = {
  getMyStore,
  updateStore,
  toggleStoreStatus,
  getAllStores,
};
