const knex = require("../config/pg");
const { uploadBufferToCloudinary } = require("../helpers/cloudUpload");

// ─── Get Vendor Dashboard ─────────────────────────────────────────────────────

const getVendorDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch the vendor's store
    const store = await knex("stores").where({ owner_id: userId }).first();
    if (!store) {
      return res.status(404).json({ success: false, msg: "No store found" });
    }

    // Aggregate product counts in a single query for efficiency
    const productStats = await knex("vendor_products")
      .where({ store_id: store.id })
      .whereNot({ status: "deleted" })
      .select(
        knex.raw("COUNT(*) as total_products"),
        knex.raw("COUNT(*) FILTER (WHERE status = 'published') as published_products"),
        knex.raw("COUNT(*) FILTER (WHERE status = 'draft') as draft_products")
      )
      .first();

    // Fetch vendor verification status
    const verification = await knex("vendor_verifications")
      .where({ user_id: String(userId) })
      .select("status", "rejection_reason")
      .first();

    return res.status(200).json({
      success: true,
      data: {
        store,
        stats: {
          total_products: parseInt(productStats.total_products, 10) || 0,
          published_products: parseInt(productStats.published_products, 10) || 0,
          draft_products: parseInt(productStats.draft_products, 10) || 0,
        },
        verification_status: verification
          ? { status: verification.status, rejection_reason: verification.rejection_reason || null }
          : { status: "not_started", rejection_reason: null },
      },
    });
  } catch (err) {
    console.error("getVendorDashboard error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Get Vendor Products (paginated) ─────────────────────────────────────────

const getVendorProducts = async (req, res) => {
  try {
    const userId = req.user.id;

    const store = await knex("stores").where({ owner_id: userId }).first();
    if (!store) {
      return res.status(404).json({ success: false, msg: "No store found" });
    }

    const { status = "all", page = 1, limit = 20 } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (parsedPage - 1) * parsedLimit;

    // Base query — always exclude deleted
    let query = knex("vendor_products")
      .where({ store_id: store.id })
      .whereNot({ status: "deleted" });

    if (status && status !== "all") {
      if (!["draft", "published"].includes(status)) {
        return res.status(400).json({
          success: false,
          msg: "status must be one of: draft, published, all",
        });
      }
      query = query.where({ status });
    }

    // Count total matching rows
    const [{ count }] = await query.clone().count("id as count");
    const total = parseInt(count, 10) || 0;

    // Fetch paginated results
    const products = await query
      .clone()
      .orderBy("created_at", "desc")
      .limit(parsedLimit)
      .offset(offset);

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        pages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (err) {
    console.error("getVendorProducts error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Get Vendor Store ─────────────────────────────────────────────────────────

const getVendorStore = async (req, res) => {
  try {
    const userId = req.user.id;

    const store = await knex("stores").where({ owner_id: userId }).first();
    if (!store) {
      return res.status(404).json({ success: false, msg: "No store found" });
    }

    // Fetch store categories
    const categories = await knex("store_categories")
      .where({ store_id: store.id })
      .select("name");

    return res.status(200).json({
      success: true,
      data: {
        ...store,
        categories: categories.map((c) => c.name),
      },
    });
  } catch (err) {
    console.error("getVendorStore error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Update Vendor Store ──────────────────────────────────────────────────────

const updateVendorStore = async (req, res) => {
  try {
    const userId = req.user.id;

    const store = await knex("stores").where({ owner_id: userId }).first();
    if (!store) {
      return res.status(404).json({ success: false, msg: "No store found" });
    }

    const { name, description } = req.body;
    const updates = { updated_at: knex.fn.now() };

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ success: false, msg: "Store name cannot be empty" });
      }
      updates.name = trimmedName;
    }

    if (description !== undefined) {
      updates.description = description ? description.trim() : null;
    }

    // Handle logo upload if a file was provided
    if (req.file) {
      const publicId = `store_logo_${store.id}_${Date.now()}`;
      const result = await uploadBufferToCloudinary(
        req.file.buffer,
        publicId,
        "image",
        `vendor_stores/${userId}`
      );
      updates.logo = result.secure_url;
    }

    if (Object.keys(updates).length === 1) {
      // Only updated_at — nothing meaningful to change
      return res.status(400).json({ success: false, msg: "No valid fields provided to update" });
    }

    const [updatedStore] = await knex("stores")
      .where({ id: store.id })
      .update(updates)
      .returning("*");

    return res.status(200).json({ success: true, data: updatedStore });
  } catch (err) {
    console.error("updateVendorStore error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  getVendorDashboard,
  getVendorProducts,
  getVendorStore,
  updateVendorStore,
};
