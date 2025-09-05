const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "credit_naira",
        "debit_naira",
        "credit_credix",
        "debit_credix",
        "buy_tradebits",
        "sell_tradebits",
        "transfer_tradebits",
        "wallet_created",
      ],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: [0, "Amount must be greater than zero"],
    },

    currency: {
      type: String,
      enum: ["naira", "credix", "tradebits"],
      required: true,
    },

    fromWallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      default: null,
    },

    toWallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "success",
    },

    reference: {
      type: String,
      unique: true,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
