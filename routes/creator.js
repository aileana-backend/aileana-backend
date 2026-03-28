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
  submitContentCategory,
  uploadDocument,
  submitSelfie,
  submitApplication,
  resubmitDocuments,
  getVerificationStatus,
  smileCallback,
} = require("../controllers/creatorController");

const {
  getDashboard,
  getEarnings,
  getTransactions,
  getBeneficiaries,
  withdraw,
  getWithdrawals,
} = require("../controllers/creatorDashboardController");

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
  handleMulterError,
  uploadDocument
);

// Step 3: Selfie + trigger Smile Identity
router.post("/creator/submit-selfie", auth, upload.single("selfie"), handleMulterError, submitSelfie);

// Step 4: Accept community guidelines + final submission
router.post("/creator/submit-application", auth, submitApplication);

// Resubmit after rejection
router.post("/creator/resubmit", auth, resubmitDocuments);

// Get current status + resume step
router.get("/creator/status", auth, getVerificationStatus);

// Smile Identity webhook (no auth)
router.post("/creator/smile-callback", smileCallback);

// ─── Creator Dashboard ────────────────────────────────────────────────────────
router.get("/creator/dashboard", auth, getDashboard);
router.get("/creator/earnings", auth, getEarnings);
router.get("/creator/transactions", auth, getTransactions);

// Beneficiaries (past payout accounts)
router.get("/creator/beneficiaries", auth, getBeneficiaries);

// Withdrawals
router.post("/creator/withdraw", auth, withdraw);
router.get("/creator/withdrawals", auth, getWithdrawals);

module.exports = router;
