// src/modules/tradebits/tradebits.route.js
const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const {
  calculate,
  initiatePurchase,
  confirmPurchase,
  previewFee,
  verifyAddress,
  confirmSend,
  getBalance,
  getTransaction,
} = require("../controllers/tradebitsController");

router.get("/calculate", auth, calculate);
router.post("/buy/initiate", auth, initiatePurchase);
router.post("/buy/confirm", auth, confirmPurchase);
router.post("/send/preview-fee", auth, previewFee);
router.post("/send/verify-address", auth, verifyAddress);
router.post("/send/confirm", auth, confirmSend);
router.get("/balance", auth, getBalance);
router.get("/transaction/:reference", auth, getTransaction);

module.exports = router;
