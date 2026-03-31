const Message = require("../models/Message");
const knex = require("../config/pg");
const { uploadBufferToCloudinary } = require("../helpers/cloudUpload");

// ─── Send Message (text or attachment) ───────────────────────────────────────

const sendMessage = async (req, res) => {
  try {
    const senderId = String(req.user.id);
    const { receiver_id, content, message_type = "text", attachment } = req.body;

    if (!receiver_id) {
      return res.status(400).json({ success: false, msg: "receiver_id is required" });
    }

    const validTypes = ["text", "location", "contact", "task", "cart", "payment"];

    if (!validTypes.includes(message_type)) {
      return res.status(400).json({
        success: false,
        msg: `For media attachments use POST /messages/attachment. Valid types here: ${validTypes.join(", ")}`,
      });
    }

    if (message_type === "text" && !content?.trim()) {
      return res.status(400).json({ success: false, msg: "content is required for text messages" });
    }

    // Build attachment payload per type
    let attachmentData = undefined;

    if (message_type === "location") {
      const { latitude, longitude, address } = attachment || {};
      if (!latitude || !longitude) {
        return res.status(400).json({ success: false, msg: "latitude and longitude are required" });
      }
      attachmentData = { latitude, longitude, address: address || null };
    }

    if (message_type === "contact") {
      const { contact_user_id, contact_name, contact_username, contact_phone } = attachment || {};
      if (!contact_user_id && !contact_name) {
        return res.status(400).json({ success: false, msg: "contact_user_id or contact_name is required" });
      }
      attachmentData = { contact_user_id, contact_name, contact_username, contact_phone };
    }

    if (message_type === "task") {
      const { task_title, task_items } = attachment || {};
      if (!task_title) {
        return res.status(400).json({ success: false, msg: "task_title is required" });
      }
      attachmentData = {
        task_title,
        task_items: Array.isArray(task_items)
          ? task_items.map((i) => ({ text: i.text || "", done: false }))
          : [],
      };
    }

    if (message_type === "cart") {
      const { cart_items } = attachment || {};
      if (!Array.isArray(cart_items) || cart_items.length === 0) {
        return res.status(400).json({ success: false, msg: "cart_items array is required" });
      }
      attachmentData = {
        cart_items: cart_items.map((item) => ({
          product_id: item.product_id,
          name:       item.name,
          price:      item.price,
          image_url:  item.image_url || null,
        })),
      };
    }

    if (message_type === "payment") {
      const { amount, currency, payment_note } = attachment || {};
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ success: false, msg: "A valid amount is required" });
      }
      attachmentData = {
        amount:         parseFloat(amount),
        currency:       currency || "NGN",
        payment_note:   payment_note || null,
        payment_status: "pending",
      };
    }

    const msg = await Message.create({
      sender_id:    senderId,
      receiver_id:  String(receiver_id),
      message_type,
      content:      content?.trim() || "",
      attachment:   attachmentData,
    });

    // Push via socket if available
    if (req.io) {
      req.io.to(`user_${receiver_id}`).emit("private_message", msg);
    }

    return res.status(201).json({ success: true, data: msg });
  } catch (err) {
    console.error("sendMessage error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Send Media Attachment (file / image / video / audio) ────────────────────

const sendAttachment = async (req, res) => {
  try {
    const senderId = String(req.user.id);
    const { receiver_id, content } = req.body;

    if (!receiver_id) {
      return res.status(400).json({ success: false, msg: "receiver_id is required" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, msg: "A file is required" });
    }

    const file = req.file;
    const mime = file.mimetype;

    // Determine message_type from mime
    let message_type = "file";
    let resource_type = "raw";
    if (mime.startsWith("image/")) { message_type = "image"; resource_type = "image"; }
    else if (mime.startsWith("video/")) { message_type = "video"; resource_type = "video"; }
    else if (mime.startsWith("audio/")) { message_type = "audio"; resource_type = "video"; } // cloudinary uses video for audio

    const publicId = `msg_${senderId}_${Date.now()}`;
    const result   = await uploadBufferToCloudinary(file.buffer, publicId, resource_type, "messages");

    const msg = await Message.create({
      sender_id:    senderId,
      receiver_id:  String(receiver_id),
      message_type,
      content:      content?.trim() || "",
      attachment: {
        url:       result.secure_url,
        name:      file.originalname,
        size:      file.size,
        mime_type: mime,
      },
    });

    if (req.io) {
      req.io.to(`user_${receiver_id}`).emit("private_message", msg);
    }

    return res.status(201).json({ success: true, data: msg });
  } catch (err) {
    console.error("sendAttachment error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Mark Message as Read ────────────────────────────────────────────────────

const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const msg = await Message.findByIdAndUpdate(messageId, { is_read: true }, { new: true });
    if (!msg) return res.status(404).json({ success: false, msg: "Message not found" });
    return res.json({ success: true, data: msg });
  } catch (err) {
    console.error("markAsRead error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Get Chat History ─────────────────────────────────────────────────────────

const getChatHistory = async (req, res) => {
  try {
    const userId      = String(req.user.id);
    const otherUserId = String(req.params.userId);

    const messages = await Message.find({
      $or: [
        { sender_id: userId,      receiver_id: otherUserId },
        { sender_id: otherUserId, receiver_id: userId },
      ],
    }).sort({ created_at: 1 });

    res.json({ success: true, data: messages });
  } catch (err) {
    console.error("getChatHistory error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// ─── Get Conversations ────────────────────────────────────────────────────────

const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    // Match both string and integer forms — socket stores integer, REST stores string
    const userIdStr = String(userId);
    const userIdInt = parseInt(userId, 10);
    const userIdMatch = { $in: [userIdStr, userIdInt] };

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender_id: userIdMatch }, { receiver_id: userIdMatch }],
        },
      },
      {
        $addFields: {
          contact_id: {
            $cond: [
              { $in: ["$sender_id", [userIdStr, userIdInt]] },
              "$receiver_id",
              "$sender_id",
            ],
          },
        },
      },
      { $sort: { created_at: -1 } },
      {
        $group: {
          _id: "$contact_id",
          last_message: { $first: "$$ROOT" },
          unread_count: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$receiver_id", String(userId)] }, { $eq: ["$is_read", false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { "last_message.created_at": -1 } },
    ]);

    const contactIds = conversations.map((c) => c._id);
    const contacts   = await knex("users")
      .whereIn("id", contactIds)
      .select("id", "first_name", "last_name", "username", "email", "is_online", "last_seen");

    const contactMap = {};
    contacts.forEach((u) => (contactMap[u.id] = u));

    const result = conversations.map((c) => ({
      contact:              contactMap[c._id] || { id: c._id },
      message_type:         c.last_message.message_type,
      last_message_content: c.last_message.content,
      last_message_at:      c.last_message.created_at,
      sender_id:            c.last_message.sender_id,
      receiver_id:          c.last_message.receiver_id,
      unread_count:         c.unread_count,
    }));

    res.json({ success: true, count: result.length, conversations: result });
  } catch (err) {
    console.error("getConversations error:", err);
    res.status(500).json({ success: false, msg: "Failed to fetch conversations" });
  }
};

// ─── Get Chat History for AI ──────────────────────────────────────────────────

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
        { sender_id: user1, receiver_id: user2 },
        { sender_id: user2, receiver_id: user1 },
      ],
    }).sort({ created_at: 1 });

    return res.status(200).json({ success: true, data: messages });
  } catch (err) {
    console.error("getUsersChatHistoryForAi error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

module.exports = {
  sendMessage,
  sendAttachment,
  markAsRead,
  getChatHistory,
  getConversations,
  getUsersChatHistoryForAi,
};
