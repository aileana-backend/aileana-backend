const ActivityLog = require("../../models/ActivityLog");
/**
 * Logs user activity to the database.
 * @param {Object} params
 * @param {String} params.userId - The ID of the user performing the action.
 * @param {String} params.action - The type of action performed.
 * @param {String} params.description - A human-readable description of the action.
 * @param {Object} [params.req] - The Express request object (optional).
 * @param {Object} [params.metadata={}] - Any additional data to store.
 */
class ActivityLogService {
  static async log({ userId, action, description, req, metadata = {} }) {
    try {
      await ActivityLog.create({
        user: userId,
        action,
        description,
        ipAddress: req?.ip || null,
        userAgent: req?.headers?.["user-agent"] || "unknown",
        metadata,
      });
    } catch (err) {
      console.error("Error saving activity log:", err);
    }
  }
}

module.exports = ActivityLogService;
