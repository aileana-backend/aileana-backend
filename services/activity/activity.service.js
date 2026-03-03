const knex = require("../../config/pg");

class ActivityLogService {
  static async log({ userId, action, description, req, metadata = {} }) {
    try {
      await knex("activity_logs").insert({
        user_id: userId,
        action,
        description,
        ip_address: req?.ip || null,
        user_agent: req?.headers?.["user-agent"] || "unknown",
        metadata: JSON.stringify(metadata),
        created_at: new Date(),
      });
    } catch (err) {
      console.error("Error saving activity log:", err.message);
    }
  }
}

module.exports = ActivityLogService;
