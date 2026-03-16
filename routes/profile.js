const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const {
  getProfile,
  updateProfile,
  getUsers,
} = require("../controllers/profileController");
const { profileUpdateRules, validate } = require("../middleware/validators");

router.get("/profile", auth, getProfile);
router.put("/profile", auth, profileUpdateRules, validate, updateProfile);
router.get("/users", auth, getUsers);

module.exports = router;
