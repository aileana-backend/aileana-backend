const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const upload = require("../middleware/upload");
const multer = require("multer");
const {
  submitBasicInfo,
  submitServiceDetails,
  submitServiceCoverage,
  uploadDocument,
  submitSelfie,
  submitPayoutMethod,
  submitApplication,
  resubmitDocuments,
  getVerificationStatus,
  smileCallback,
} = require("../controllers/serviceProviderController");

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("MulterError on", req.originalUrl, err.message);
    return res.status(400).json({ success: false, msg: err.message });
  }
  next(err);
};

// Step 1: Personal info
router.post("/service-provider/basic-info", auth, submitBasicInfo);

// Step 2: Service details
router.post("/service-provider/service-details", auth, submitServiceDetails);

// Step 3: Service coverage
router.post("/service-provider/service-coverage", auth, submitServiceCoverage);

// Step 4: Upload identity document (front required, back optional)
router.post(
  "/service-provider/upload-document",
  auth,
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  handleMulterError,
  uploadDocument
);

// Step 5: Selfie + trigger Smile Identity
router.post(
  "/service-provider/submit-selfie",
  auth,
  upload.single("selfie"),
  handleMulterError,
  submitSelfie
);

// Step 6: Payout method
router.post("/service-provider/payout-method", auth, submitPayoutMethod);

// Step 7: Terms agreement + final submission
router.post("/service-provider/submit-application", auth, submitApplication);

// Resubmit after rejection
router.post("/service-provider/resubmit", auth, resubmitDocuments);

// Get current status + resume step
router.get("/service-provider/status", auth, getVerificationStatus);

// Smile Identity webhook (no auth)
router.post("/service-provider/smile-callback", smileCallback);

module.exports = router;
