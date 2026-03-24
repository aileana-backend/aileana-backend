const mongoose = require("mongoose");
const MessageSchema = new mongoose.Schema(
  {
    // Store PostgreSQL UUIDs as strings
    sender: {
      type: String,
      required: true,
    },
    receiver: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
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
