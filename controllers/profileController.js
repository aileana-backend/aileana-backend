const User = require("../models/User");

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Update logged-in user profile
const updateProfile = async (req, res) => {
  try {
    const allowedFields = [
      "firstname",
      "middlename",
      "surname",
      "name",
      "phone",
      "avatar",
      "dob",
      "gender",
      "title",
      "address_line_1",
      "address_line_2",
      "city",
      "state",
      "country",
    ];

    // Filter only allowed fields from req.body
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

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
