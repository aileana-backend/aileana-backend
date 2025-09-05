const express = require("express");
const router = express.Router();
const {
  createUserWallet,

  getUserWalletBalance,
  updateWalletBalance,
} = require("../controllers/walletController");
const { auth } = require("../middleware/auth");

// Create wallet
router.post("/create", auth, createUserWallet);

// Get wallet balance
router.get("/balance", auth, getUserWalletBalance);

// Update wallet balance
router.put("/update", auth, updateWalletBalance);

module.exports = router;
