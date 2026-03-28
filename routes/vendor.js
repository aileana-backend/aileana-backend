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

module.exports = router;
