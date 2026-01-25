const { success } = require("zod");
const Message = require("../models/Message");
const User = require("../models/User");
const mongoose = require("mongoose");

const getChatHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const otherUserId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "first_name last_name email username")
      .populate("receiver", "first_name last_name email username");

    res.json({ messages });
  } catch (err) {
    console.error("getChatHistory error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

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
            text: "$lastMessage.content",
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

    res.json({
      success: true,
      count: conversations.length,
      conversations,
    });
  } catch (err) {
    console.error("getConversations aggregation error:", err);
    res.status(500).json({
      success: false,
      msg: "Failed to fetch conversations",
    });
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
  } catch (err) {
    console.error("getUsersChatHistoryForAi error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

module.exports = { getChatHistory, getUsersChatHistoryForAi, getConversations };
