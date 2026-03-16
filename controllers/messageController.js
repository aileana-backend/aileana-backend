const knex = require("../config/pg");

const getChatHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = req.params.userId;

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

    res.json({ messages });
  } catch (err) {
    console.error("getChatHistory error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

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
              [userId],
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

    res.json({
      success: true,
      count: conversations.length,
      conversations,
    });
  } catch (err) {
    console.error("getConversations error:", err);
    res
      .status(500)
      .json({ success: false, msg: "Failed to fetch conversations" });
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

    const messages = await knex("messages")
      .where(function () {
        this.where({ sender_id: user1, receiver_id: user2 }).orWhere({
          sender_id: user2,
          receiver_id: user1,
        });
      })
      .orderBy("created_at", "asc");

    return res.status(200).json({ success: true, data: messages });
  } catch (err) {
    console.error("getUsersChatHistoryForAi error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

module.exports = { getChatHistory, getUsersChatHistoryForAi, getConversations };
