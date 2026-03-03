const knex = require("../config/pg"); // adjust path to your knex config

async function logActivity({
  userId,
  action,
  description,
  req,
  metadata = {},
}) {
  try {
    await knex("activity_logs").insert({
      user_id: userId,
      action,
      description,
      ip_address: req?.ip,
      user_agent: req?.headers["user-agent"],
      metadata: JSON.stringify(metadata),
      created_at: knex.fn.now(), 
    });
  } catch (err) {
    console.error("Error saving activity log:", err);
  }
}

module.exports = logActivity;