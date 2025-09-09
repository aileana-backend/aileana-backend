const Message = require("../models/Message");
const User = require("../models/User");
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

    if (!user1 || !user2) {
      return res.status(400).json({ msg: "details of both users is required" });
    }

    const [u1, u2] = await Promise.all([
      User.findById(user1).select("smartReplyEnabled"),
      User.findById(user2).select("smartReplyEnabled"),
    ]);

    if (!u1 || !u2) {
      return res.status(404).json({ msg: "One or both users not found" });
    }

    if (!u1.smartReplyEnabled || !u2.smartReplyEnabled) {
      return res.status(403).json({
        msg: "Smart reply not enabled by both users",
      });
    }

    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 },
      ],
    }).sort({ timestamp: 1 });

    res.json({ messages });
  } catch (err) {
    console.error("getUsersChatHistoryForAi error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

const toggleSmartReply = async (req, res) => {
  try {
    const userId = req.user._id;
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ msg: "enabled must be true or false" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { smartReplyEnabled: enabled },
      { new: true, select: "username email smartReplyEnabled" }
    );

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json({
      msg: `Smart reply has been ${enabled ? "enabled" : "disabled"}`,
      user,
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};
module.exports = { getChatHistory, getUsersChatHistoryForAi, toggleSmartReply };
