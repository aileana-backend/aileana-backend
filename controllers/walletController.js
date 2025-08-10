const Wallet = require("../models/Wallet");
const {
  createWallet,
  getWalletBalance,
} = require("../middleware/utils/onepipe");

const PROVIDER_CODE = process.env.ONEPIPE_PROVIDER_CODE || "FidelityVirtual";
const PROVIDER_NAME = process.env.ONEPIPE_PROVIDER_NAME || "FidelityVirtual";

// this is to create a wallet for the logged in user

const createUserWallet = async (req, res) => {
  try {
    const user = req.user;

    // here, i am checking if wallet exists and returning it
    const existingWallet = await Wallet.findOne({ user: user._id });
    if (existingWallet) {
      return res.status(200).json({
        status: "Successful",
        message: "Wallet already exists",
        data: existingWallet,
      });
    }

    const walletUserData = {
      _id: user._id,
      customer_ref: `user_${user._id}`,
      firstname: user?.firstname || "",
      surname: user?.surname || "",
      email: user?.email || "",
      mobile_no: user?.phone || "",
      provider_code: PROVIDER_CODE,
      provider_name: PROVIDER_NAME,
      account_type: "static", // or "dynamic"
    };

    const response = await createWallet(walletUserData);

    return res.status(201).json({
      status: response.status,
      message: response.message || "Wallet created successfully",
      data: response.data || {},
    });
  } catch (err) {
    console.error("Wallet creation error:", err.message);
    return res.status(500).json({
      status: "Error",
      message: "Failed to create wallet",
      error: err.message,
    });
  }
};

// here is to get balance for logged in user

const getUserWalletBalance = async (req, res) => {
  try {
    const user = req.user;
    const wallet = await Wallet.findOne({ user: user._id });

    if (!wallet) {
      return res.status(404).json({
        status: "Error",
        message: "Wallet not found. Please create one first.",
      });
    }

    const balanceInfo = await getWalletBalance(wallet);

    return res.status(200).json({
      status: balanceInfo.status,
      message: "Wallet balance retrieved successfully",
      balance: balanceInfo.balance,
      currency: balanceInfo.currency,
    });
  } catch (err) {
    console.error("Wallet balance retrieval error:", err.message);
    return res.status(500).json({
      status: "Error",
      message: "Failed to retrieve wallet balance",
      error: err.message,
    });
  }
};

module.exports = { createUserWallet, getUserWalletBalance };
