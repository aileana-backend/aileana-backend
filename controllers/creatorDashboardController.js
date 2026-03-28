const knex = require("../config/pg");
const { randomUUID: uuidv4 } = require("crypto");

// ─── GET /creator/dashboard ───────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const userId = String(req.user.id);

    const [user, verification, earningsSummary, recentEarnings, wallet] =
      await Promise.all([
        knex("users").where({ id: req.user.id }).first(),
        knex("creator_verifications").where({ user_id: userId }).first(),
        knex("creator_earnings")
          .where({ creator_id: userId })
          .select(
            knex.raw("COALESCE(SUM(amount), 0) AS total_earnings"),
            knex.raw(
              "COALESCE(SUM(CASE WHEN status = 'available' THEN amount ELSE 0 END), 0) AS available_balance"
            )
          )
          .first(),
        knex("creator_earnings")
          .where({ creator_id: userId })
          .orderBy("created_at", "desc")
          .limit(5),
        knex("wallets")
          .where({ user_id: req.user.id, is_deleted: false })
          .first(),
      ]);

    const pendingPayouts = await knex("creator_payouts")
      .where({ creator_id: userId, status: "pending" })
      .sum("amount as total")
      .first();

    const checklist = {
      profile_completed: !!(user?.first_name && user?.last_name),
      profile_picture_added: !!user?.profile_image,
      creator_verified: verification?.status === "verified",
    };

    return res.json({
      success: true,
      data: {
        earnings: {
          total: parseFloat(earningsSummary?.total_earnings || 0),
          available_balance: parseFloat(earningsSummary?.available_balance || 0),
          pending_payout: parseFloat(pendingPayouts?.total || 0),
        },
        wallet: wallet
          ? {
              account_number: wallet.account_number,
              bank_name: wallet.bank_name,
              wallet_address_name: wallet.wallet_address_name,
              balance: parseFloat(wallet.balance || 0),
            }
          : null,
        checklist,
        recent_transactions: recentEarnings,
        is_verified: verification?.status === "verified",
        verification_status: verification?.status || "not_started",
      },
    });
  } catch (err) {
    console.error("getDashboard error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── GET /creator/earnings ────────────────────────────────────────────────────
const getEarnings = async (req, res) => {
  try {
    const userId = String(req.user.id);

    const [summary, pendingPayouts, chartData] = await Promise.all([
      knex("creator_earnings")
        .where({ creator_id: userId })
        .select(
          knex.raw("COALESCE(SUM(amount), 0) AS total_earnings"),
          knex.raw(
            "COALESCE(SUM(CASE WHEN status = 'available' THEN amount ELSE 0 END), 0) AS available_balance"
          ),
          knex.raw("COALESCE(SUM(amount), 0) AS lifetime_hits")
        )
        .first(),
      knex("creator_payouts")
        .where({ creator_id: userId, status: "pending" })
        .sum("amount as total")
        .first(),
      knex("creator_earnings")
        .where({ creator_id: userId })
        .select(
          knex.raw("DATE(created_at) as date"),
          knex.raw("SUM(amount) as amount")
        )
        .groupByRaw("DATE(created_at)")
        .orderBy("date", "asc")
        .limit(30),
    ]);

    return res.json({
      success: true,
      data: {
        total_earnings: parseFloat(summary?.total_earnings || 0),
        available_balance: parseFloat(summary?.available_balance || 0),
        pending_payout: parseFloat(pendingPayouts?.total || 0),
        lifetime_hits: parseFloat(summary?.lifetime_hits || 0),
        chart: chartData,
      },
    });
  } catch (err) {
    console.error("getEarnings error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── GET /creator/transactions ────────────────────────────────────────────────
const getTransactions = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [earnings, payouts, total] = await Promise.all([
      knex("creator_earnings")
        .where({ creator_id: userId })
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset),
      knex("creator_payouts")
        .where({ creator_id: userId })
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset),
      knex("creator_earnings")
        .where({ creator_id: userId })
        .count("id as count")
        .first(),
    ]);

    const all = [
      ...earnings.map((e) => ({ ...e, entry_type: "earning" })),
      ...payouts.map((p) => ({ ...p, entry_type: "payout" })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({
      success: true,
      data: all,
      pagination: {
        page,
        limit,
        total: parseInt(total?.count || 0),
      },
    });
  } catch (err) {
    console.error("getTransactions error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── GET /creator/beneficiaries ───────────────────────────────────────────────
// Returns unique bank accounts previously used for withdrawals
const getBeneficiaries = async (req, res) => {
  try {
    const userId = String(req.user.id);

    const beneficiaries = await knex("creator_payouts")
      .where({ creator_id: userId })
      .select("bank_name", "account_number", "account_name")
      .groupBy("bank_name", "account_number", "account_name")
      .orderByRaw("MAX(created_at) DESC");

    return res.json({ success: true, data: beneficiaries });
  } catch (err) {
    console.error("getBeneficiaries error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── POST /creator/withdraw ───────────────────────────────────────────────────
const withdraw = async (req, res) => {
  try {
    const { amount, bank_name, account_number, account_name } = req.body;
    const userId = String(req.user.id);

    if (!amount || !bank_name || !account_number || !account_name) {
      return res.status(400).json({
        success: false,
        msg: "amount, bank_name, account_number and account_name are required",
      });
    }

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ success: false, msg: "Invalid amount" });
    }

    // Check available balance
    const summary = await knex("creator_earnings")
      .where({ creator_id: userId, status: "available" })
      .sum("amount as total")
      .first();

    const available = parseFloat(summary?.total || 0);
    if (withdrawAmount > available) {
      return res.status(400).json({
        success: false,
        msg: `Insufficient balance. Available: ₦${available.toFixed(2)}`,
      });
    }

    // Create payout record
    const reference = `CPAY-${uuidv4().split("-")[0].toUpperCase()}`;
    const [payout] = await knex("creator_payouts")
      .insert({
        creator_id: userId,
        amount: withdrawAmount,
        bank_name,
        account_number,
        account_name,
        status: "pending",
        reference,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");

    // Mark earnings as withdrawn FIFO — oldest first
    let remaining = withdrawAmount;
    const availableEarnings = await knex("creator_earnings")
      .where({ creator_id: userId, status: "available" })
      .orderBy("created_at", "asc");

    for (const earning of availableEarnings) {
      if (remaining <= 0) break;
      const earningAmount = parseFloat(earning.amount);
      if (earningAmount <= remaining) {
        await knex("creator_earnings")
          .where({ id: earning.id })
          .update({ status: "withdrawn", updated_at: new Date() });
        remaining -= earningAmount;
      } else {
        await knex("creator_earnings")
          .where({ id: earning.id })
          .update({ amount: earningAmount - remaining, updated_at: new Date() });
        await knex("creator_earnings").insert({
          creator_id: userId,
          amount: remaining,
          type: earning.type,
          source_id: earning.source_id,
          description: earning.description,
          status: "withdrawn",
          created_at: earning.created_at,
          updated_at: new Date(),
        });
        remaining = 0;
      }
    }

    return res.json({
      success: true,
      msg: "Withdrawal initiated. Funds will be processed within 24 hours.",
      data: payout,
    });
  } catch (err) {
    console.error("withdraw error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── GET /creator/withdrawals ─────────────────────────────────────────────────
const getWithdrawals = async (req, res) => {
  try {
    const payouts = await knex("creator_payouts")
      .where({ creator_id: String(req.user.id) })
      .orderBy("created_at", "desc");

    return res.json({ success: true, data: payouts });
  } catch (err) {
    console.error("getWithdrawals error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

module.exports = {
  getDashboard,
  getEarnings,
  getTransactions,
  getBeneficiaries,
  withdraw,
  getWithdrawals,
};
