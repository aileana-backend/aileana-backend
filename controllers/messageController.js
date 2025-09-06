const Message = require("../models/Message");

const getChatHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const otherUserId = req.params.userId;
    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
    }).sort({ timestamp: 1 });
    res.json({ messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

const getUsersChatHistoryForAi = async (req, res) => {
  try {
    const user1 = req?.params?.user1;
    const user2 = req?.params?.user2;

    if (!user2 || !user1)
      return res.status(400).json({ msg: "details of both users is required" });
    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user2 },
      ],
    }).sort({ timestamp: 1 });
    res.json({ messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};
module.exports = { getChatHistory, getUsersChatHistoryForAi };
