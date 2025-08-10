const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { getChatHistory } = require("../controllers/messageController");

// fetch history with a specific user
router.get("/messages/:userId", auth, getChatHistory);

module.exports = router;
