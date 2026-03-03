<<<<<<< HEAD
const { success } = require("zod");
const Message = require("../models/Message");
const User = require("../models/User");
const mongoose = require("mongoose");
=======
const knex = require("../config/pg");
>>>>>>> payment

const getChatHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = req.params.userId;

<<<<<<< HEAD
    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "first_name last_name email username")
      .populate("receiver", "first_name last_name email username");
=======
    const messages = await knex("messages")
      .where(function () {
        this.where({ sender_id: userId, receiver_id: otherUserId }).orWhere({
          sender_id: otherUserId,
          receiver_id: userId,
        });
      })
      .join("users as sender", "messages.sender_id", "sender.id")
      .join("users as receiver", "messages.receiver_id", "receiver.id")
      .select(
        "messages.*",
        "sender.first_name as sender_first_name",
        "sender.last_name as sender_last_name",
        "sender.email as sender_email",
        "sender.username as sender_username",
        "receiver.first_name as receiver_first_name",
        "receiver.last_name as receiver_last_name",
        "receiver.email as receiver_email",
        "receiver.username as receiver_username",
      )
      .orderBy("messages.created_at", "asc");
>>>>>>> payment

    res.json({ messages });
  } catch (err) {
    console.error("getChatHistory error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

<<<<<<< HEAD
// const getConversations = async (req, res) => {
//   try {
//     const userId = req.user._id;

//     const messages = await Message.find({
//       $or: [{ sender: userId }, { receiver: userId }],
//     })
//       .sort({ createdAt: -1 })
//       .populate("sender", "first_name last_name username email")
//       .populate("receiver", "first_name last_name username email");

//     const conversationsMap = new Map();

//     for (let msg of messages) {
//       const otherUser =
//         msg.sender._id.toString() === userId.toString()
//           ? msg.receiver
//           : msg.sender;

//       if (!conversationsMap.has(otherUser._id.toString())) {
//         conversationsMap.set(otherUser._id.toString(), {
//           user: otherUser,
//           lastMessage: msg,
//         });
//       }
//     }

//     // Convert map to array
//     const conversations = Array.from(conversationsMap.values());

//     res.json({ conversations });
//   } catch (err) {
//     console.error("getConversations error:", err);
//     res.status(500).json({ msg: "Server error" });
//   }
// };

/**
 * Retrieves the latest message for every unique contact a user has interacted with.
 * Mimics the WhatsApp "Home" screen logic.
 */
const getConversations = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const conversations = await Message.aggregate([
      // 1. Find all messages involving this user
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }],
        },
      },
      // 2. Sort by date descending so the newest messages are processed first
      { $sort: { createdAt: -1 } },
      // 3. Create a 'contactId' field to group by (the person the user is talking to)
      {
        $addFields: {
          contactId: {
            $cond: [{ $eq: ["$sender", userId] }, "$receiver", "$sender"],
          },
        },
      },
      // 4. Group by the contactId and grab the first message (the latest one)
      {
        $group: {
          _id: "$contactId",
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiver", userId] },
                    { $eq: ["$isRead", false] }, // Assumes you have an isRead field
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      // 5. Look up user details for the contact
      {
        $lookup: {
          from: "users", // Must match your actual User collection name in MongoDB
          localField: "_id",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      // 6. Clean up the output
      { $unwind: "$userDetails" },
      {
        $project: {
          _id: 0,
          contact: {
            _id: "$userDetails._id",
            first_name: "$userDetails.first_name",
            last_name: "$userDetails.last_name",
            username: "$userDetails.username",
            email: "$userDetails.email",
            avatar: "$userDetails.avatar",
          },
          lastMessage: {
            content: "$lastMessage.content",
            createdAt: "$lastMessage.createdAt",
            sender: "$lastMessage.sender",
            receiver: "$lastMessage.receiver",
          },
          unreadCount: 1,
        },
      },

      // 7. Final sort to ensure the conversation with the newest message is on top
      { $sort: { "lastMessage.createdAt": -1 } },
    ]);
=======
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get the latest message per unique contact using a subquery
    const conversations = await knex
      .with("ranked_messages", (qb) => {
        qb.from("messages")
          .where("sender_id", userId)
          .orWhere("receiver_id", userId)
          .select(
            "messages.*",
            knex.raw(
              `
              CASE
                WHEN sender_id = ? THEN receiver_id
                ELSE sender_id
              END AS contact_id
            `,
              [userId],
            ),
            knex.raw(
              `
              ROW_NUMBER() OVER (
                PARTITION BY
                  CASE
                    WHEN sender_id = ? THEN receiver_id
                    ELSE sender_id
                  END
                ORDER BY created_at DESC
              ) AS rn
            `,
              [userId, userId],
            ),
            knex.raw(
              `
              SUM(CASE WHEN receiver_id = ? AND is_read = false THEN 1 ELSE 0 END)
              OVER (
                PARTITION BY
                  CASE
                    WHEN sender_id = ? THEN receiver_id
                    ELSE sender_id
                  END
              ) AS unread_count
            `,
              [userId, userId],
            ),
          );
      })
      .from("ranked_messages")
      .join("users as contact", "ranked_messages.contact_id", "contact.id")
      .where("ranked_messages.rn", 1)
      .select(
        "contact.id as contact_id",
        "contact.first_name",
        "contact.last_name",
        "contact.username",
        "contact.email",
        "ranked_messages.content as last_message_content",
        "ranked_messages.created_at as last_message_at",
        "ranked_messages.sender_id",
        "ranked_messages.receiver_id",
        "ranked_messages.unread_count",
      )
      .orderBy("ranked_messages.created_at", "desc");
>>>>>>> payment

    res.json({
      success: true,
      count: conversations.length,
      conversations,
    });
  } catch (err) {
<<<<<<< HEAD
    console.error("getConversations aggregation error:", err);
    res.status(500).json({
      success: false,
      msg: "Failed to fetch conversations",
    });
=======
    console.error("getConversations error:", err);
    res
      .status(500)
      .json({ success: false, msg: "Failed to fetch conversations" });
>>>>>>> payment
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

<<<<<<< HEAD
    // if (!u1.smartReplyEnabled || !u2.smartReplyEnabled) {
    //   return res.status(403).json({
    //     msg: "Smart reply not enabled by both users",
    //   });
    // }

    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 },
      ],
    }).sort({ timestamp: 1 });

    //return res.json({ messages });
    return res.status(200).json({
      success: true,
      data: messages,
    });
=======
    const messages = await knex("messages")
      .where(function () {
        this.where({ sender_id: user1, receiver_id: user2 }).orWhere({
          sender_id: user2,
          receiver_id: user1,
        });
      })
      .orderBy("created_at", "asc");

    return res.status(200).json({ success: true, data: messages });
>>>>>>> payment
  } catch (err) {
    console.error("getUsersChatHistoryForAi error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

module.exports = { getChatHistory, getUsersChatHistoryForAi, getConversations };
