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

module.exports = { getProfile, updateProfile };
