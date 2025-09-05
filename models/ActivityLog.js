const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true, // e.g., "signup", "login", "password_change", "wallet_created"
    },
    description: {
      type: String,
      default: "",
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String, // browser or device info
    },
    metadata: {
      type: Object, // store extra details like { otp: "123456" } or { amount: 100 }
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ActivityLog", activityLogSchema);
