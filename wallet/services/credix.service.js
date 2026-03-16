const knex = require("../../config/pg");
const crypto = require("crypto");

// Credit rewards per task type
const TASK_REWARDS = {
  CREATE_POST:     { amount: 5,  label: "Create Post",  description: "Earned credits for creating a post" },
  LIKE_POST:       { amount: 5,  label: "Like",         description: "Earned credits for liking a post" },
  COMMENT:         { amount: 2,  label: "Comment",      description: "Earned credits for commenting on a post" },
  SHARE:           { amount: 5,  label: "Share",        description: "Earned credits for sharing a post" },
  POST_VIEWS_1000: { amount: 50, label: "1000 views",   description: "Earned credits for reaching 1000 views" },
};

class CredixService {
  // ─── GET BALANCE ─────────────────────────────────────────────────────────

  async getBalance(userId) {
    const wallet = await knex("credix_wallets")
      .where({ user_id: userId })
      .select("balance")
      .first();

    return { balance: wallet?.balance || 0 };
  }

  // ─── GET AVAILABLE TASKS ─────────────────────────────────────────────────

  async getAvailableTasks() {
    return Object.entries(TASK_REWARDS).map(([type, config]) => ({
      type,
      label: config.label,
      amount: config.amount,
    }));
  }

  // ─── AWARD CREDITS ───────────────────────────────────────────────────────

  /**
   * Award credits for a completed action. Idempotent — uses source_id to prevent double awards.
   * @param {string} userId
   * @param {string} taskType     - one of TASK_REWARDS keys
   * @param {string} sourceId     - unique ID for deduplication (post ID, comment ID, etc.)
   */
  async awardCredits(userId, taskType, sourceId) {
    const task = TASK_REWARDS[taskType];
    if (!task) return null;

    // Deduplicate: one award per user per task per source
    const existing = await knex("credix_transactions")
      .where({ user_id: userId, task_type: taskType, source_id: String(sourceId) })
      .first();

    if (existing) return null; // already awarded

    const reference = `CREDIX-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    return await knex.transaction(async (trx) => {
      // Upsert credix wallet
      const wallet = await trx("credix_wallets")
        .where({ user_id: userId })
        .first();

      if (wallet) {
        await trx("credix_wallets")
          .where({ user_id: userId })
          .increment("balance", task.amount)
          .update({ updated_at: new Date() });
      } else {
        await trx("credix_wallets").insert({
          user_id: userId,
          balance: task.amount,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      // Record transaction
      const [tx] = await trx("credix_transactions")
        .insert({
          user_id: userId,
          task_type: taskType,
          source_id: String(sourceId),
          amount: task.amount,
          description: task.description,
          reference,
          created_at: new Date(),
        })
        .returning("*");

      return {
        awarded: task.amount,
        label: task.label,
        reference: tx.reference,
      };
    });
  }

  // ─── EARNING HISTORY ─────────────────────────────────────────────────────

  /**
   * Returns earning history grouped by month (matches Figma: "January 2026", "December 2025")
   */
  async getHistory(userId) {
    const transactions = await knex("credix_transactions")
      .where({ user_id: userId })
      .orderBy("created_at", "desc")
      .select("*");

    const groups = {};

    transactions.forEach((tx) => {
      const label = new Intl.DateTimeFormat("en-NG", {
        month: "long",
        year: "numeric",
      }).format(new Date(tx.created_at));

      if (!groups[label]) groups[label] = [];
      groups[label].push({
        id: tx.id,
        reference: tx.reference,
        task_type: tx.task_type,
        description: tx.description,
        amount: `+${tx.amount} coins`,
        date: new Intl.DateTimeFormat("en-NG", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(tx.created_at)),
        created_at: tx.created_at,
      });
    });

    return Object.entries(groups).map(([label, transactions]) => ({
      label,
      transactions,
    }));
  }
}

module.exports = new CredixService();
module.exports.TASK_REWARDS = TASK_REWARDS;
