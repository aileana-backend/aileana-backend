const knex = require("../config/pg");

const getProfile = async (req, res) => {
  try {
    const user = await knex("users")
      .where({ id: req.user.id })
      .select(
        "id",
        "first_name",
        "middle_name",
        "last_name",
        "username",
        "email",
        "dob",
        "gender",
        "phone_number",
        "address",
        "city",
        "state",
        "biometric_preference",
        "status",
        "verified",
        "is_online",
        "last_seen",
        "terms_accepted",
        "smart_reply_enabled",
        "kyc_completed",
        "kyc_status",
        "created_at",
        "updated_at",
      )
      .first();

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const allowedFields = [
      "first_name",
      "middle_name",
      "last_name",
      "phone_number",
      "dob",
      "gender",
      "address",
      "city",
      "state",
    ];

    const updates = { updated_at: new Date() };
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const [user] = await knex("users")
      .where({ id: req.user.id })
      .update(updates)
      .returning([
        "id",
        "first_name",
        "middle_name",
        "last_name",
        "username",
        "email",
        "dob",
        "gender",
        "phone_number",
        "address",
        "city",
        "state",
        "biometric_preference",
        "status",
        "verified",
        "is_online",
        "last_seen",
        "terms_accepted",
        "smart_reply_enabled",
        "kyc_completed",
        "kyc_status",
        "created_at",
        "updated_at",
      ]);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

const getUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim();

    const baseQuery = knex("users").whereNot({ id: req.user.id }).where({
      is_deleted: false,
    });

    if (search) {
      baseQuery.where(function () {
        this.whereILike("username", `%${search}%`)
          .orWhereILike("first_name", `%${search}%`)
          .orWhereILike("last_name", `%${search}%`)
          .orWhereILike("email", `%${search}%`);
      });
    }

    const [{ count }] = await baseQuery.clone().count("id as count");
    const total = parseInt(count);

    const users = await baseQuery
      .select(
        "id",
        "first_name",
        "last_name",
        "username",
        "email",
        "is_online",
        "last_seen",
      )
      .orderBy("first_name", "asc")
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    console.error("getUsers error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

module.exports = { getProfile, updateProfile, getUsers };
