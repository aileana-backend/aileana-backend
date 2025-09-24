const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../utils/crypto");
const MessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,

      set: (msg) => (msg ? encrypt(msg) : msg),
      get: (msg) => (msg ? decrypt(msg) : msg),
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

module.exports = mongoose.model("Message", MessageSchema);
