const express = require("express");
const { auth } = require("../middleware/auth");
const {
  getWallet,
  transferfunds,
  transferP2P,
  getAllCreatedWallets,
  validateBvn,
  validateBankAccount,
  sendToExternalAccount,
  initiateNairaWalletKYC,
  verifyNairaWalletKycOtp,
  uploadKYCDocument,
  getWalletByType,
  getBanks,
  resolveAccount,
  getTransferStatus,
  getReceiveFundsDetails,
  addPin,
  verifyTradebitAddress,
  getTradebitsBalance,
  transferTradebits,
  previewTradebitFee,
  tradebitTransaction,
  getTradebitHistory,
} = require("../controllers/walletController");
const { initiatePurchase, confirmPurchase } = require("../controllers/tradebitsController.js")
const router = express.Router();
const upload = require("../middleware/upload");

router.post("/transaction-pin", auth, addPin);
router.get("/receive-funds-details", auth, getReceiveFundsDetails);
router.post("/validate-account-name", auth, resolveAccount);
router.get("/banks", auth, getBanks);
router.post(
  "/kyc/upload-id",
  auth,
  upload.fields([
    { name: "id_image", maxCount: 1 }, // ID card photo
    { name: "selfie", maxCount: 1 }, // selfie photo
  ]),
  uploadKYCDocument,
);
router.post("/verify-naira-wallet-otp", auth, verifyNairaWalletKycOtp);
router.post("/naira-wallet-kyc", auth, initiateNairaWalletKYC);
router.get("/wallet", auth, getWallet);
router.post("/transfer", auth, transferfunds);
router.post("/transfer-p2p/:walletId", auth, transferP2P);
router.get("/all-created-wallet", auth, getAllCreatedWallets);
router.post("/validate-bvn", auth, validateBvn);
router.get("/validate-bank-account", auth, validateBankAccount);
router.post("/external-account", auth, sendToExternalAccount);
// router.get("/financial-accounts", listAllFinancialAccounts);
router.get("/", auth, getWalletByType);

//TRADEBITS
router.post("/verify-address", auth, verifyTradebitAddress);
router.get("/tradebits-balance", auth, getTradebitsBalance);
router.post("/send-tradebits", auth, transferTradebits);
router.post("/preview-tradebits-fee", auth, previewTradebitFee);
router.get("/tradebits/history", auth, getTradebitHistory);
router.post("/tradebits/buy/initiate", auth, initiatePurchase);
router.post("/tradebits/buy/confirm", auth, confirmPurchase);

router.get("/tradebits/:reference", auth, tradebitTransaction);
router.get("/transfer-status/:reference", auth, getTransferStatus);

module.exports = router;
