const express = require("express");
const router = express.Router();
const { auth, verifySocketToken } = require("../middleware/auth");
const {
  getChatHistory,
  getUsersChatHistoryForAi,
  toggleSmartReply,
} = require("../controllers/messageController");
const Message = require("../models/Message");
router.post("/messages/toggle-smart-reply", auth, toggleSmartReply);
// fetch history with a specific user
router.get("/messages/:userId", auth, getChatHistory);
router.get("/messages/ai/:user1/:user2", auth, getUsersChatHistoryForAi);
router.post("/messages", auth, async (req, res) => {
  try {
    const { receiver, content } = req.body;
    console.log(receiver, content);
    const msg = new Message({
      sender: req.user._id,
      receiver,
      content,
    });
    await msg.save();

    // emit in real-time too
    req.io.to(`user_${receiver}`).emit("private_message", msg);

    return res.json(msg);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

module.exports = router;
