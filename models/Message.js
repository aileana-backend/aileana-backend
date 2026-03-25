const mongoose = require("mongoose");
const MessageSchema = new mongoose.Schema(
  {
    // Store PostgreSQL UUIDs as strings
    sender_id: {
      type: String,
      required: true,
    },
    receiver_id: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    is_read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

module.exports = mongoose.model("Message", MessageSchema);
