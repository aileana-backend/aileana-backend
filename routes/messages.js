const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const {
  getChatHistory,
  getUsersChatHistoryForAi,
  getConversations,
} = require("../controllers/messageController");

router.get("/conversations", auth, getConversations);
router.get("/messages/:userId", auth, getChatHistory);
router.get("/messages/ai/:user1/:user2", auth, getUsersChatHistoryForAi);


module.exports = router;
