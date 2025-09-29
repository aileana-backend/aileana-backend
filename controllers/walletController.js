const Wallet = require("../models/Wallet");
const mongoose = require("mongoose");

const logTransaction = require("../utils/transactionLogger");
const PROVIDER_CODE = process.env.ONEPIPE_PROVIDER_CODE || "FidelityVirtual";
const PROVIDER_NAME = process.env.ONEPIPE_PROVIDER_NAME || "FidelityVirtual";

// this is to create a wallet for the logged in user
const createUserWallet = async (req, res) => {
  try {
    const existingWallet = await Wallet.findOne({ userId: req.user.id });
    if (existingWallet) {
      return res.status(400).json({ message: "Wallet already existsindd" });
    }

    const wallet = await Wallet.create({
      userId: req.user.id,
      nairaBalance: 0,
      credixBalance: 0,
      tradebitBalance: 0,
    });
    await wallet.save();
    await logTransaction({
      user: req.user._id,
      wallet: wallet._id,
      type: "wallet_created",
      amount: 0,
      currency: "naira",
    });
    res.status(201).json(wallet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// here is to get balance for logged in user

const getUserWalletBalance = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }
    res.json(wallet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const updateWalletBalance = async (req, res) => {
  try {
    const { type, amount } = req.body;
    // type = "naira" | "credix" | "trademit"
    // amount can be +ve (credit) or -ve (debit)

    const wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }
    let txType, currency;
    switch (type) {
      case "naira":
        wallet.nairaBalance += amount;
        txType = amount > 0 ? "credit_naira" : "debit_naira";
        currency = "naira";
        break;
      case "credix":
        wallet.credixBalance += amount;
        txType = amount > 0 ? "credit_credix" : "debit_credix";
        currency = "credix";
        break;
      case "tradebit":
        wallet.tradebitBalance += amount;
        txType = amount > 0 ? "buy_tradebits" : "debit_tradebits";
        currency = "tradebits";
        break;
      default:
        return res.status(400).json({ message: "Invalid wallet type" });
    }

    await wallet.save();
    await logTransaction({
      user: req.user.id,
      wallet: wallet._id,
      type: txType,
      amount: Math.abs(amount),
      currency,
    });
    res.json(wallet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const creditCredix = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json({ status: "Error", message: "Invalid amount" });
    }

    const user = req.user;
    const wallet = await Wallet.findOne({ user: user._id });
    if (!wallet) {
      return res
        .status(404)
        .json({ status: "Error", message: "Wallet not found" });
    }

    wallet.credixBalance += amount;
    await wallet.save();
    await logTransaction({
      user: user._id,
      wallet: wallet._id,
      type: "credit_credix",
      amount,
      currency: "credix",
    });
    return res.status(200).json({
      status: "Successful",
      message: `Credix credited: ${amount}`,
      balances: wallet.balances,
    });
  } catch (err) {
    console.error("Credix credit error:", err.message);
    return res
      .status(500)
      .json({ status: "Error", message: "Failed to credit Credix" });
  }
};
const buyTradebits = async (req, res) => {
  try {
    const { amount } = req.body;
    const user = req.user;
    const wallet = await Wallet.findOne({ user: user._id });

    if (!wallet || amount <= 0) {
      return res
        .status(400)
        .json({ status: "Error", message: "Invalid request" });
    }

    if (wallet.nairaBalance < amount) {
      return res.status(400).json({ message: "Insufficient Naira balance" });
    }

    const rate = 100;
    const tradebitQty = amount / rate;

    wallet.nairaBalance -= amount;
    wallet.tradebitBalance += tradebitQty;
    await wallet.save();
    await logTransaction({
      user: user._id,
      wallet: wallet._id,
      type: "buy_tradebits",
      amount: tradebitQty,
      currency: "tradebits",
    });

    return res.status(200).json({
      status: "Successful",
      message: "Tradebits purchased successfully",
      wallet: wallet,
    });
  } catch (err) {
    console.error("Buy Tradebits error:", err.message);
    return res
      .status(500)
      .json({ status: "Error", message: "Failed to buy Tradebits" });
  }
};
const transferTradebits = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sender = req.user;

    const { recipientId, amount } = req.body;

    // Validate input
    if (!amount || amount <= 0) {
      throw new Error("Invalid amount. Must be a positive number");
    }

    const senderWallet = await Wallet.findOne({ user: sender._id }).session(
      session
    );
    const recipientWallet = await Wallet.findOne({ user: recipientId }).session(
      session
    );

    if (!senderWallet || !recipientWallet) {
      return res
        .status(404)
        .json({ status: "Error", message: "Wallet not found" });
    }

    if (senderWallet.tradebitBalance < amount) {
      return res
        .status(400)
        .json({ status: "Error", message: "Insufficient Tradebits balance" });
    }

    senderWallet.tradebitBalance -= amount;
    recipientWallet.tradebitBalance += amount;

    await senderWallet.save({ session });
    await recipientWallet.save({ session });
    await session.commitTransaction();
    await logTransaction({
      user: sender._id,
      wallet: senderWallet._id,
      type: "transfer_tradebits",
      amount,
      currency: "tradebits",
      toWallet: recipientWallet._id,
    });

    await logTransaction({
      user: recipientId,
      wallet: recipientWallet._id,
      type: "transfer_tradebits",
      amount,
      currency: "tradebits",
      fromWallet: senderWallet._id,
    });
    session.endSession();
    return res.status(200).json({
      status: "Successful",
      message: "Tradebits transferred successfully",
      senderBalance: senderWallet.tradebitBalance,
      recipientBalance: recipientWallet.tradebitBalance,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Transfer Tradebits error:", err.message);
    return res
      .status(500)
      .json({ status: "Error", message: "Failed to transfer Tradebits" });
  }
};

module.exports = {
  createUserWallet,
  getUserWalletBalance,
  creditCredix,
  buyTradebits,
  transferTradebits,
  updateWalletBalance,
};
