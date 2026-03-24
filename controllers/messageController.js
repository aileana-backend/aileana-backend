const Message = require("../models/Message");
const knex = require("../config/pg");

const getChatHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
    }).sort({ createdAt: 1 });

    res.json({ messages });
  } catch (err) {
    console.error("getChatHistory error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get last message per unique contact + unread count
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }],
        },
      },
      {
        $addFields: {
          contact_id: {
            $cond: [{ $eq: ["$sender", userId] }, "$receiver", "$sender"],
          },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$contact_id",
          last_message: { $first: "$$ROOT" },
          unread_count: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$receiver", userId] }, { $eq: ["$read", false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { "last_message.createdAt": -1 } },
    ]);

    // Fetch contact details from PostgreSQL
    const contactIds = conversations.map((c) => c._id);
    const contacts = await knex("users")
      .whereIn("id", contactIds)
      .select("id", "first_name", "last_name", "username", "email", "profile_picture");

    const contactMap = {};
    contacts.forEach((u) => (contactMap[u.id] = u));

    const result = conversations.map((c) => ({
      contact: contactMap[c._id] || { id: c._id },
      last_message_content: c.last_message.content,
      last_message_at: c.last_message.createdAt,
      sender_id: c.last_message.sender,
      receiver_id: c.last_message.receiver,
      unread_count: c.unread_count,
    }));

    res.json({ success: true, count: result.length, conversations: result });
  } catch (err) {
    console.error("getConversations error:", err);
    res.status(500).json({ success: false, msg: "Failed to fetch conversations" });
  }
};

const getUsersChatHistoryForAi = async (req, res) => {
  try {
    const { user1, user2 } = req.params;

    if (!user1 || !user2) {
      return res.status(400).json({ msg: "Details of both users is required" });
    }

    const [u1, u2] = await Promise.all([
      knex("users").where({ id: user1 }).select("smart_reply_enabled").first(),
      knex("users").where({ id: user2 }).select("smart_reply_enabled").first(),
    ]);

    if (!u1 || !u2) {
      return res.status(404).json({ msg: "One or both users not found" });
    }

    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 },
      ],
    }).sort({ createdAt: 1 });

    return res.status(200).json({ success: true, data: messages });
  } catch (err) {
    console.error("getUsersChatHistoryForAi error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

module.exports = { getChatHistory, getUsersChatHistoryForAi, getConversations };
