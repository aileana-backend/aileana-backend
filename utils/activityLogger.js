const ActivityLog = require("../models/ActivityLog");

async function logActivity({
  userId,
  action,
  description,
  req,
  metadata = {},
}) {
  try {
    await ActivityLog.create({
      user: userId,
      action,
      description,
      ipAddress: req?.ip,
      userAgent: req?.headers["user-agent"],
      metadata,
    });
  } catch (err) {
    console.error("Error saving activity log:", err);
  }
}
module.exports = logActivity;
