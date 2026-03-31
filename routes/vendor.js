const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const upload = require("../middleware/upload");
const multer = require("multer");

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("MulterError on", req.originalUrl, err.message);
    return res.status(400).json({ success: false, msg: err.message });
  }
  next(err);
};

const {
  submitBasicInfo,
  uploadDocument,
  submitSelfie,
  submitBusinessDetails,
  submitPayoutMethod,
  submitApplication,
  resubmitDocuments,
  getVerificationStatus,
  smileCallback,
} = require("../controllers/vendorController");

const {
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
} = require("../controllers/vendorProductController");

const {
  getVendorDashboard,
  getVendorProducts,
  getVendorStore,
  updateVendorStore,
} = require("../controllers/vendorDashboardController");

// ─── Vendor Verification Routes ───────────────────────────────────────────────

// Step 1: Basic personal info
router.post("/vendor/basic-info", auth, submitBasicInfo);

// Step 2: Upload document (front required, back optional)
router.post(
  "/vendor/upload-document",
  auth,
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  handleMulterError,
  uploadDocument
);

// Step 3: Selfie + trigger Smile Identity
router.post("/vendor/submit-selfie", auth, upload.single("selfie"), handleMulterError, submitSelfie);

// Step 4: Business / shop details
router.post("/vendor/business-details", auth, submitBusinessDetails);

// Step 5: Payout method
router.post("/vendor/payout-method", auth, submitPayoutMethod);

// Step 6: Vendor agreement + final submission
router.post("/vendor/submit-application", auth, submitApplication);

// Resubmit after rejection
router.post("/vendor/resubmit", auth, resubmitDocuments);

// Get current status + resume step
router.get("/vendor/status", auth, getVerificationStatus);

// Smile Identity webhook (no auth)
router.post("/vendor/smile-callback", smileCallback);

// ─── Vendor Dashboard ─────────────────────────────────────────────────────────

router.get("/vendor/dashboard", auth, getVendorDashboard);
router.get("/vendor/store", auth, getVendorStore);
router.patch("/vendor/store", auth, upload.single("logo"), handleMulterError, updateVendorStore);
router.get("/vendor/products", auth, getVendorProducts);

// ─── Vendor Product Management (multi-step add flow) ─────────────────────────

router.post("/vendor/product/details", auth, addProductDetails);
router.post(
  "/vendor/product/media",
  auth,
  upload.array("images", 5),
  handleMulterError,
  uploadProductMedia
);
router.post("/vendor/product/pricing", auth, updateProductPricing);
router.post("/vendor/product/variants", auth, updateProductVariants);
router.post("/vendor/product/shipping", auth, updateProductShipping);
router.post("/vendor/product/publish", auth, publishProduct);
router.get("/vendor/my-products", auth, getMyProducts);
router.get("/vendor/product/:id", auth, getProductById);
router.patch("/vendor/product/:id", auth, updateProduct);
router.delete("/vendor/product/:id", auth, deleteProduct);

// ─── Public Product Routes (no auth required) ─────────────────────────────────

router.get("/vendor/public/product/:id", getPublicProduct);
router.get("/vendor/public/store/:storeId/products", getPublicStoreProducts);

module.exports = router;
