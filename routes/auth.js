const express = require("express");
const router = express.Router();
const passport = require("passport");

const {
  loginLimiter,
  generalAuthLimiter,
} = require("../middleware/rateLimit.js");
const {
  signup,
  login,
  changePassword,
  resetPassword,
  forgotPassword,
  requestChangePassword,
  verifyChangePassword,
  verifyAccountOtp,
  resendAccountOtp,
  biometricLogin,
  suggestUsernames,
  toggleSmartReply,
} = require("../controllers/authController");
const {
  signupRules,
  loginRules,
  validate,
} = require("../middleware/validators");
const { auth } = require("../middleware/auth");

router.post("/signup", signupRules, validate, signup);
router.post("/login", loginRules, validate, loginLimiter, login);
router.post("/bio-login", biometricLogin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", auth, changePassword);
router.post("/change-password-request", auth, requestChangePassword);
router.post("/change-password-verify", auth, verifyChangePassword);
router.post("/verify-otp", verifyAccountOtp);
router.post("/resend-otp", resendAccountOtp);
router.post("/suggest-usernames", suggestUsernames);
router.post("/messages/toggle-smart-reply", auth, toggleSmartReply);
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  async (req, res) => {
    try {
      const user = req.user;
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      });
      // const token = jwt.sign(
      //   { id: user._id, email: user.email },
      //   process.env.JWT_SECRET,
      //   { expiresIn: "7d" }
      // );
      res.status(201).json({
        token,
        user,
      });
      // res.json({
      //   status: "success",
      //   token,
      //   user,
      // });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: "error", message: "Internal server error" });
    }
  }
);
module.exports = router;
