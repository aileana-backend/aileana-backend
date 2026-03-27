const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const upload = require("../middleware/upload");
const {
  submitContentCategory,
  uploadDocument,
  submitSelfie,
  submitApplication,
  resubmitDocuments,
  getVerificationStatus,
  smileCallback,
} = require("../controllers/creatorController");

// Step 1: Select content categories
router.post("/creator/category", auth, submitContentCategory);

// Step 2: Upload identity document (front required, back optional)
router.post(
  "/creator/upload-document",
  auth,
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  uploadDocument
);

// Step 3: Selfie + trigger Smile Identity
router.post("/creator/submit-selfie", auth, upload.single("selfie"), submitSelfie);

// Step 4: Accept community guidelines + final submission
router.post("/creator/submit-application", auth, submitApplication);

// Resubmit after rejection
router.post("/creator/resubmit", auth, resubmitDocuments);

// Get current status + resume step
router.get("/creator/status", auth, getVerificationStatus);

// Smile Identity webhook (no auth)
router.post("/creator/smile-callback", smileCallback);

module.exports = router;
