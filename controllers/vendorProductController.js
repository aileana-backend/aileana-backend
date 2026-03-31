const { randomUUID } = require("crypto");
const knex = require("../config/pg");
const { uploadBufferToCloudinary } = require("../helpers/cloudUpload");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolves the store that belongs to the given user.
 * Returns the store row or null.
 */
async function getStoreByUser(userId) {
  const store = await knex("stores").where({ owner_id: userId }).first();
  return store || null;
}

/**
 * Verifies that a product belongs to the given store and is not deleted.
 * Returns the product row or null.
 */
async function getProductForStore(productId, storeId) {
  const product = await knex("vendor_products")
    .where({ id: productId, store_id: storeId })
    .whereNot({ status: "deleted" })
    .first();
  return product || null;
}

// ─── Step 1: Product Details ──────────────────────────────────────────────────

const addProductDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, category, description } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        msg: "name and category are required",
      });
    }

    // Confirm the user has a store
    const store = await getStoreByUser(userId);
    if (!store) {
      return res.status(404).json({
        success: false,
        msg: "You do not have a store. Please complete vendor onboarding first.",
      });
    }

    // Confirm the user is a verified vendor
    const verification = await knex("vendor_verifications")
      .where({ user_id: String(userId) })
      .first();

    if (!verification || verification.status !== "verified") {
      return res.status(403).json({
        success: false,
        msg: "Your vendor account is not verified. Please complete verification before adding products.",
      });
    }

    const [product] = await knex("vendor_products")
      .insert({
        store_id: store.id,
        user_id: userId,
        name: name.trim(),
        category: category.trim(),
        description: description ? description.trim() : null,
        price: 0, // placeholder until pricing step
        status: "draft",
      })
      .returning("*");

    return res.status(201).json({ success: true, data: product });
  } catch (err) {
    console.error("addProductDetails error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 2: Upload Product Media ─────────────────────────────────────────────

const uploadProductMedia = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        msg: "At least one image is required",
      });
    }

    // Confirm the user has a store
    const store = await getStoreByUser(userId);
    if (!store) {
      return res.status(404).json({
        success: false,
        msg: "No store found for this user",
      });
    }

    // Find the most recent draft product for this store
    let product;
    if (req.body.productId) {
      product = await getProductForStore(req.body.productId, store.id);
    } else {
      product = await knex("vendor_products")
        .where({ store_id: store.id, user_id: userId, status: "draft" })
        .orderBy("created_at", "desc")
        .first();
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        msg: "No draft product found. Please complete step 1 first.",
      });
    }

    // Upload each image buffer to Cloudinary
    const uploadResults = await Promise.all(
      req.files.map((file, index) => {
        const publicId = `product_${product.id}_${index}_${Date.now()}`;
        return uploadBufferToCloudinary(
          file.buffer,
          publicId,
          "image",
          `vendor_products/${userId}`
        );
      })
    );

    const newImages = uploadResults.map((result) => ({
      url: result.secure_url,
      public_id: result.public_id,
    }));

    // Merge with any existing images
    const existingImages = Array.isArray(product.images) ? product.images : [];
    const mergedImages = [...existingImages, ...newImages];

    const [updatedProduct] = await knex("vendor_products")
      .where({ id: product.id })
      .update({ images: JSON.stringify(mergedImages), updated_at: knex.fn.now() })
      .returning("*");

    return res.status(200).json({ success: true, data: updatedProduct });
  } catch (err) {
    console.error("uploadProductMedia error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 3: Pricing ──────────────────────────────────────────────────────────

const updateProductPricing = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, price, discount_price } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, msg: "productId is required" });
    }

    const parsedPrice = parseFloat(price);
    if (!price || isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({
        success: false,
        msg: "price must be a positive number",
      });
    }

    const store = await getStoreByUser(userId);
    if (!store) {
      return res.status(404).json({ success: false, msg: "No store found for this user" });
    }

    const product = await getProductForStore(productId, store.id);
    if (!product) {
      return res.status(404).json({ success: false, msg: "Product not found" });
    }

    const updates = {
      price: parsedPrice,
      updated_at: knex.fn.now(),
    };

    if (discount_price !== undefined && discount_price !== null && discount_price !== "") {
      const parsedDiscount = parseFloat(discount_price);
      if (isNaN(parsedDiscount) || parsedDiscount < 0) {
        return res.status(400).json({
          success: false,
          msg: "discount_price must be a non-negative number",
        });
      }
      if (parsedDiscount >= parsedPrice) {
        return res.status(400).json({
          success: false,
          msg: "discount_price must be less than price",
        });
      }
      updates.discount_price = parsedDiscount;
    } else {
      updates.discount_price = null;
    }

    const [updatedProduct] = await knex("vendor_products")
      .where({ id: product.id })
      .update(updates)
      .returning("*");

    return res.status(200).json({ success: true, data: updatedProduct });
  } catch (err) {
    console.error("updateProductPricing error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 4: Variants ─────────────────────────────────────────────────────────

const updateProductVariants = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, sizes, colors } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, msg: "productId is required" });
    }

    const store = await getStoreByUser(userId);
    if (!store) {
      return res.status(404).json({ success: false, msg: "No store found for this user" });
    }

    const product = await getProductForStore(productId, store.id);
    if (!product) {
      return res.status(404).json({ success: false, msg: "Product not found" });
    }

    const variants = {
      sizes: Array.isArray(sizes) ? sizes.map((s) => String(s).trim()).filter(Boolean) : [],
      colors: Array.isArray(colors) ? colors.map((c) => String(c).trim()).filter(Boolean) : [],
    };

    const [updatedProduct] = await knex("vendor_products")
      .where({ id: product.id })
      .update({ variants: JSON.stringify(variants), updated_at: knex.fn.now() })
      .returning("*");

    return res.status(200).json({ success: true, data: updatedProduct });
  } catch (err) {
    console.error("updateProductVariants error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 5: Shipping ─────────────────────────────────────────────────────────

const updateProductShipping = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, weight, unit, free_shipping, ship_from, processing_time, methods } =
      req.body;

    if (!productId) {
      return res.status(400).json({ success: false, msg: "productId is required" });
    }

    const store = await getStoreByUser(userId);
    if (!store) {
      return res.status(404).json({ success: false, msg: "No store found for this user" });
    }

    const product = await getProductForStore(productId, store.id);
    if (!product) {
      return res.status(404).json({ success: false, msg: "Product not found" });
    }

    const shipping = {
      weight: weight !== undefined ? weight : null,
      unit: unit || null,
      free_shipping: free_shipping === true || free_shipping === "true",
      ship_from: ship_from || null,
      processing_time: processing_time || null,
      methods: Array.isArray(methods) ? methods : [],
    };

    const [updatedProduct] = await knex("vendor_products")
      .where({ id: product.id })
      .update({ shipping: JSON.stringify(shipping), updated_at: knex.fn.now() })
      .returning("*");

    return res.status(200).json({ success: true, data: updatedProduct });
  } catch (err) {
    console.error("updateProductShipping error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Publish Product ──────────────────────────────────────────────────────────

const publishProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, msg: "productId is required" });
    }

    const store = await getStoreByUser(userId);
    if (!store) {
      return res.status(404).json({ success: false, msg: "No store found for this user" });
    }

    const product = await getProductForStore(productId, store.id);
    if (!product) {
      return res.status(404).json({ success: false, msg: "Product not found" });
    }

    // Validate that essential fields are present before publishing
    if (!product.name || !product.category) {
      return res.status(400).json({
        success: false,
        msg: "Product must have a name and category before publishing",
      });
    }

    if (!product.price || parseFloat(product.price) <= 0) {
      return res.status(400).json({
        success: false,
        msg: "Product must have a valid price before publishing",
      });
    }

    const images = Array.isArray(product.images) ? product.images : [];
    if (images.length === 0) {
      return res.status(400).json({
        success: false,
        msg: "Product must have at least one image before publishing",
      });
    }

    const [updatedProduct] = await knex("vendor_products")
      .where({ id: product.id })
      .update({ status: "published", updated_at: knex.fn.now() })
      .returning("*");

    return res.status(200).json({
      success: true,
      msg: "Product published successfully",
      data: updatedProduct,
    });
  } catch (err) {
    console.error("publishProduct error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Get My Products ──────────────────────────────────────────────────────────

const getMyProducts = async (req, res) => {
  try {
    const userId = req.user.id;

    const store = await getStoreByUser(userId);
    if (!store) {
      return res.status(404).json({ success: false, msg: "No store found for this user" });
    }

    const products = await knex("vendor_products")
      .where({ store_id: store.id })
      .whereNot({ status: "deleted" })
      .orderBy("created_at", "desc");

    return res.status(200).json({ success: true, data: products });
  } catch (err) {
    console.error("getMyProducts error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Get Product By ID (protected) ───────────────────────────────────────────

const getProductById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const store = await getStoreByUser(userId);
    if (!store) {
      return res.status(404).json({ success: false, msg: "No store found for this user" });
    }

    const product = await getProductForStore(id, store.id);
    if (!product) {
      return res.status(404).json({ success: false, msg: "Product not found" });
    }

    return res.status(200).json({ success: true, data: product });
  } catch (err) {
    console.error("getProductById error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Update Product (PATCH) ───────────────────────────────────────────────────

const updateProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, category, description, price, discount_price, variants, shipping } = req.body;

    const store = await getStoreByUser(userId);
    if (!store) {
      return res.status(404).json({ success: false, msg: "No store found for this user" });
    }

    const product = await getProductForStore(id, store.id);
    if (!product) {
      return res.status(404).json({ success: false, msg: "Product not found" });
    }

    const updates = { updated_at: knex.fn.now() };

    if (name !== undefined) updates.name = name.trim();
    if (category !== undefined) updates.category = category.trim();
    if (description !== undefined) updates.description = description ? description.trim() : null;

    if (price !== undefined) {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        return res.status(400).json({ success: false, msg: "price must be a positive number" });
      }
      updates.price = parsedPrice;
    }

    if (discount_price !== undefined) {
      if (discount_price === null || discount_price === "") {
        updates.discount_price = null;
      } else {
        const parsedDiscount = parseFloat(discount_price);
        if (isNaN(parsedDiscount) || parsedDiscount < 0) {
          return res.status(400).json({
            success: false,
            msg: "discount_price must be a non-negative number",
          });
        }
        const effectivePrice = updates.price || parseFloat(product.price);
        if (parsedDiscount >= effectivePrice) {
          return res.status(400).json({
            success: false,
            msg: "discount_price must be less than price",
          });
        }
        updates.discount_price = parsedDiscount;
      }
    }

    if (variants !== undefined) {
      const variantData = {
        sizes: Array.isArray(variants.sizes)
          ? variants.sizes.map((s) => String(s).trim()).filter(Boolean)
          : [],
        colors: Array.isArray(variants.colors)
          ? variants.colors.map((c) => String(c).trim()).filter(Boolean)
          : [],
      };
      updates.variants = JSON.stringify(variantData);
    }

    if (shipping !== undefined) {
      updates.shipping = JSON.stringify(shipping);
    }

    if (Object.keys(updates).length === 1) {
      // Only updated_at was set — nothing to update
      return res.status(400).json({ success: false, msg: "No valid fields provided to update" });
    }

    const [updatedProduct] = await knex("vendor_products")
      .where({ id: product.id })
      .update(updates)
      .returning("*");

    return res.status(200).json({ success: true, data: updatedProduct });
  } catch (err) {
    console.error("updateProduct error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Delete Product (soft delete) ────────────────────────────────────────────

const deleteProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const store = await getStoreByUser(userId);
    if (!store) {
      return res.status(404).json({ success: false, msg: "No store found for this user" });
    }

    const product = await getProductForStore(id, store.id);
    if (!product) {
      return res.status(404).json({ success: false, msg: "Product not found" });
    }

    await knex("vendor_products")
      .where({ id: product.id })
      .update({ status: "deleted", updated_at: knex.fn.now() });

    return res.status(200).json({ success: true, msg: "Product deleted successfully" });
  } catch (err) {
    console.error("deleteProduct error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Public: Get Single Published Product ────────────────────────────────────

const getPublicProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await knex("vendor_products as vp")
      .join("stores as s", "vp.store_id", "s.id")
      .where("vp.id", id)
      .where("vp.status", "published")
      .where("s.is_active", true)
      .select(
        "vp.*",
        "s.name as store_name",
        "s.description as store_description",
        "s.logo as store_logo"
      )
      .first();

    if (!product) {
      return res.status(404).json({ success: false, msg: "Product not found" });
    }

    return res.status(200).json({ success: true, data: product });
  } catch (err) {
    console.error("getPublicProduct error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Public: Get All Published Products For a Store ──────────────────────────

const getPublicStoreProducts = async (req, res) => {
  try {
    const { storeId } = req.params;

    // Verify the store exists and is active
    const store = await knex("stores").where({ id: storeId, is_active: true }).first();
    if (!store) {
      return res.status(404).json({ success: false, msg: "Store not found" });
    }

    const products = await knex("vendor_products")
      .where({ store_id: storeId, status: "published" })
      .orderBy("created_at", "desc");

    return res.status(200).json({ success: true, data: products });
  } catch (err) {
    console.error("getPublicStoreProducts error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  addProductDetails,
  uploadProductMedia,
  updateProductPricing,
  updateProductVariants,
  updateProductShipping,
  publishProduct,
  getMyProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getPublicProduct,
  getPublicStoreProducts,
};
