const express = require("express");
const router = express.Router();
const { auth, verifySocketToken } = require("../middleware/auth");
const {
  getChatHistory,
  getUsersChatHistoryForAi,
  toggleSmartReply,
  getConversations,
} = require("../controllers/messageController");
const knex = require("../config/pg");
router.get("/conversations", auth, getConversations);

router.get("/messages/:userId", auth, getChatHistory);
router.get("/messages/ai/:user1/:user2", auth, getUsersChatHistoryForAi);

router.post("/messages", auth, async (req, res) => {
  try {
    const receiver_id = req.body.receiver_id ;
    const { content } = req.body;
    const [msg] = await knex("messages")
      .insert({ sender_id: req.user.id, receiver_id, content, is_read: false })
      .returning("*");

    req.io.to(`user_${receiver_id}`).emit("private_message", msg);

    return res.json(msg);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

module.exports = router;
