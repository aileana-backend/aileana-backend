const mongoose = require("mongoose");

const WalletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  externalId: { type: String },
  balance: { type: Number, default: 0 },
  currency: { type: String, default: "NGN" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Wallet", WalletSchema);
