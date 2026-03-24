const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const {
  getChatHistory,
  getUsersChatHistoryForAi,
  getConversations,
} = require("../controllers/messageController");

const Message = require("../models/Message");

router.get("/conversations", auth, getConversations);
router.get("/messages/:userId", auth, getChatHistory);
router.get("/messages/ai/:user1/:user2", auth, getUsersChatHistoryForAi);

router.post("/messages", auth, async (req, res) => {
  try {
    const { receiver_id, content } = req.body;
    const msg = await Message.create({
      sender: req.user.id,
      receiver: receiver_id,
      content,
    });

    req.io.to(`user_${receiver_id}`).emit("private_message", msg);

    return res.json(msg);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

module.exports = router;
