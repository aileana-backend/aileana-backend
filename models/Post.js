const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["product", "normal"],
      default: "normal",
    },
    content: { type: String, required: true },

    media: [
      {
        url: { type: String },
        type: {
          type: String,
          enum: ["image", "video", "audio"],
          required: true,
        },
        duration: { type: Number },
      },
    ],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: { type: String },
        audio: {
          url: { type: String },
          duration: { type: Number },
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    uploadStatus: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
    },
  },

  { timestamps: true }
);

module.exports = mongoose.model("Post", PostSchema);
