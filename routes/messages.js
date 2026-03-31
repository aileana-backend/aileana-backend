const express = require("express");
const router = express.Router();
const multer = require("multer");
const { auth } = require("../middleware/auth");
const upload = require("../middleware/upload");
const {
  sendMessage,
  sendAttachment,
  markAsRead,
  getChatHistory,
  getConversations,
  getUsersChatHistoryForAi,
} = require("../controllers/messageController");

const handleMulterError = (err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, msg: err.message });
  }
  next(err);
};

// Conversations list
router.get("/conversations", auth, getConversations);

// Send text / location / contact / task / cart / payment
router.post("/messages/send", auth, sendMessage);

// Send file / image / video / audio
router.post("/messages/attachment", auth, upload.single("file"), handleMulterError, sendAttachment);

// Mark message as read
router.patch("/messages/:messageId/read", auth, markAsRead);

// Chat history
router.get("/messages/ai/:user1/:user2", auth, getUsersChatHistoryForAi);
router.get("/messages/:userId", auth, getChatHistory);

module.exports = router;
