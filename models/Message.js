const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    sender_id: { type: String, required: true },
    receiver_id: { type: String, required: true },

    // text | file | image | video | audio | location | contact | task | cart | payment
    message_type: {
      type: String,
      enum: ["text", "file", "image", "video", "audio", "location", "contact", "task", "cart", "payment"],
      default: "text",
    },

    // Plain text content (required for text messages, optional caption for others)
    content: { type: String, default: "" },

    // Attachment payload — shape depends on message_type
    attachment: {
      // file | image | video | audio
      url:       { type: String },
      name:      { type: String },
      size:      { type: Number },
      mime_type: { type: String },

      // location
      latitude:  { type: Number },
      longitude: { type: Number },
      address:   { type: String },

      // contact
      contact_user_id: { type: String },
      contact_name:    { type: String },
      contact_username:{ type: String },
      contact_phone:   { type: String },

      // task
      task_title: { type: String },
      task_items: [{ text: String, done: { type: Boolean, default: false } }],

      // cart — array of vendor product snapshots
      cart_items: [
        {
          product_id: String,
          name:       String,
          price:      Number,
          image_url:  String,
        },
      ],

      // payment
      amount:           { type: Number },
      currency:         { type: String, default: "NGN" },
      payment_note:     { type: String },
      payment_status:   { type: String, enum: ["pending", "paid", "declined"], default: "pending" },
      payment_reference:{ type: String },
    },

    is_read: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

module.exports = mongoose.model("Message", MessageSchema);
