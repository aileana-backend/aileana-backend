const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const validator = require("validator");
const logTransaction = require("../utils/transactionLogger");
const logActivity = require("../utils/activityLogger");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Store = require("../models/Store");
const knex = require("../config/pg");
const walletService = require("../services/wallet/wallet.service");
const sendEmail = require("../utils/sendMail");

const generateOTPTemplate = (firstName, otp) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body {
      margin: 0; padding: 0; background-color: #f4f7fa;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .wrapper { width: 100%; padding: 40px 10px; background-color: #f4f7fa; }
    .card {
      max-width: 500px; margin: 0 auto; background: #ffffff;
      border-radius: 20px; overflow: hidden;
      box-shadow: 0 15px 35px rgba(30, 58, 138, 0.08);
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
      padding: 40px 20px; text-align: center;
    }
    .logo { max-width: 140px; filter: brightness(0) invert(1); }
    .content { padding: 48px 40px; text-align: center; }
    .greeting {
      font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 16px;
    }
    .text {
      font-size: 16px; line-height: 1.6; color: #64748b; margin-bottom: 32px;
    }
    .otp-box {
      background: #f1f5f9; border-radius: 16px;
      padding: 24px; margin: 0 auto 32px;
      border: 2px solid #e2e8f0; display: inline-block;
    }
    .otp {
      font-size: 42px; font-weight: 800; letter-spacing: 8px;
      color: #1e3a8a; font-family: 'Courier New', Courier, monospace;
    }
    .expiry {
      font-size: 13px; color: #94a3b8; font-weight: 500;
    }
    .divider { height: 1px; background: #f1f5f9; margin: 40px 0; }
    .footer {
      padding-bottom: 40px; text-align: center;
      font-size: 12px; color: #94a3b8; line-height: 1.8;
    }
    .footer strong { color: #475569; }
    @media (max-width: 480px) {
      .content { padding: 40px 24px; }
      .otp { font-size: 34px; letter-spacing: 5px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <img src="https://your-domain.com/white-logo.png" alt="AILEANA" class="logo" />
      </div>
      <div class="content">
        <div class="greeting">Hi ${firstName || "there"}!</div>
        <div class="text">
          Welcome to the future of commerce. Use the secure code below to verify your account and get started with <strong>AILEANA</strong>.
        </div>
        <div class="otp-box">
          <div class="otp">${otp}</div>
        </div>
        <div class="expiry">
          Security Note: This code will expire in 10 minutes.
        </div>
        <div class="divider"></div>
        <div style="font-size: 13px; color: #94a3b8;">
          Didn't request this? Please ignore this email or contact support.
        </div>
      </div>
    </div>
    <div class="footer">
      © 2026 <strong>AILEANA</strong><br/>
      Smart Commerce • Socially Connected • AI-Driven<br/>
      Lagos • London • Toronto
    </div>
  </div>
</body>
</html>
`;
};

const getUser = async (req, res) => {
  try {
    const user = await knex("users")
      .where({ id: req.user.id })
      .select("*")
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Fetch both wallets in one query using whereIn
    const wallets = await knex("wallets")
      .where({ user_id: user.id })
      .whereIn("currency_code", ["USD", "NGN"])
      .select("currency_code", "status");

    // Shape into { USD: { status: '...' }, NGN: { status: '...' } }
    const walletStatus = wallets.reduce((acc, wallet) => {
      acc[wallet.currency_code] = { status: wallet.status };
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: {
        user,
        wallets: walletStatus,
      }
    });
  } catch (err) {
    console.error("getUser error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};

const signup = async (req, res) => {
  const trx = await knex.transaction();

  try {
    const {
      username,
      first_name,
      middle_name,
      last_name,
      email,
      dob,
      gender,
      password,
      biometricPreference,
      termsAccepted,
    } = req.body;

    // --- VALIDATIONS ---
    if (!termsAccepted)
      throw new Error("You must accept the Terms & Conditions.");
    if (!username || username.length < 3)
      throw new Error("Username too short.");

    const existingUser = await trx("users")
      .where({ email })
      .orWhere({ username })
      .first();
    if (existingUser) throw new Error("Email or Username already exists.");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 1. Create User
    const [newUser] = await trx("users")
      .insert({
        username,
        first_name,
        middle_name,
        last_name,
        email,
        dob: dob || null,
        gender: gender || null,
        password: hashedPassword,
        biometric_preference: biometricPreference || "None",
        terms_accepted: true,
        otp,
        otp_type: "signup",
        otp_expires: new Date(Date.now() + 10 * 60 * 1000),
      })
      .returning("*");

    // 2. Create Store
    const [store] = await trx("stores")
      .insert({ owner_id: newUser.id })
      .returning("*");

    // 3. Link Store to User
    await trx("users").where({ id: newUser.id }).update({ store_id: store.id });

    // 4. Log Activity
    await logActivity(
      {
        userId: newUser.id,
        action: "signup",
        description: "User registered successfully.",
        req,
      },
      trx,
    );

    // 5. Send verification email
    const subject = "Account verification OTP";
    const htmlContent = generateOTPTemplate(newUser.first_name, otp);
    await sendEmail(newUser.email, subject, htmlContent);

    await trx.commit();

    const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    res.status(201).json({ token, newUser });
  } catch (err) {
    await trx.rollback();
    console.error("Signup error - Transaction Rolled Back:", err);
    res.status(400).json({ error: err.message || "Server error" });
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await knex("users")
      .where({ email: email.toLowerCase() })
      .first();
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    // Fetch both wallets in one query using whereIn
    const wallets = await knex("wallets")
      .where({ user_id: user.id })
      .whereIn("currency_code", ["USD", "NGN"])
      .select("currency_code", "status");

    // Shape into { USD: { status: '...' }, NGN: { status: '...' } }
    const walletStatus = wallets.reduce((acc, wallet) => {
      acc[wallet.currency_code] = { status: wallet.status };
      return acc;
    }, {});

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    await logActivity({
      userId: user.id,
      action: "login",
      description: "User logged in successfully.",
      req,
    });

    res.json({ token, user, wallets: walletStatus });
  } catch (err) {
    next(err);
  }
};

const updateUserProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const updates = {
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      middle_name: req.body.middle_name,
      username: req.body.username,
      phone: req.body.phone,
      bio: req.body.bio,
      dob: req.body.dob,
      gender: req.body.gender,
      bvn: req.body.bvn,
      nin: req.body.nin,
    };

    // remove undefined fields
    Object.keys(updates).forEach(
      (key) => updates[key] === undefined && delete updates[key],
    );

    /* ----------------------------------
       UNIQUENESS CHECKS
    ---------------------------------- */

    const orConditions = [];

    if (updates.username) {
      orConditions.push({ username: updates.username });
    }

    if (updates.bvn) {
      orConditions.push({ bvn: updates.bvn });
    }

    if (updates.nin) {
      orConditions.push({ nin: updates.nin });
    }

    if (orConditions.length > 0) {
      const existingUser = await User.findOne({
        _id: { $ne: userId }, // exclude current user
        $or: orConditions,
      });

      if (existingUser) {
        if (existingUser.username === updates.username) {
          return res.status(409).json({
            success: false,
            message: "Username already in use",
          });
        }

        if (existingUser.bvn === updates.bvn) {
          return res.status(409).json({
            success: false,
            message: "BVN already assigned to another user",
          });
        }

        if (existingUser.nin === updates.nin) {
          return res.status(409).json({
            success: false,
            message: "NIN already assigned to another user",
          });
        }
      }
    }

    /* ----------------------------------
       UPDATE USER
    ---------------------------------- */

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await knex("users").where({ email }).first();
    if (!user) {
      return res.status(404).json({ error: "No account with that email." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await knex("users")
      .where({ email })
      .update({
        otp,
        otp_expires: new Date(Date.now() + 10 * 60 * 1000),
        otp_type: "reset",
      });

    const subject = "Password Reset OTP";
    const htmlContent = `
      <p>Hello ${user.first_name || "User"},</p>
      <p>Your password reset OTP is:</p>
      <h2>${otp}</h2>
      <p>This OTP will expire in 10 minutes.</p>
      <p>If you didn't request this, you can ignore this email.</p>
    `;

    try {
      await sendEmail(user.email, subject, htmlContent);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    res.json({ message: "Password reset OTP has been sent to your email." });
  } catch (error) {
    console.error("Forgot password error:", error);
    await logActivity({
      userId: null,
      action: "forgot_password_error",
      description: `Unexpected server error during forgot password: ${error.message}`,
      req,
    });
    res.status(500).json({ error: "Server error. Try again later." });
  }
};

const verifyForgetPasswordOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await knex("users").where({ email }).first();
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (
      !user.otp ||
      !user.otp_expires ||
      Date.now() > new Date(user.otp_expires).getTime()
    ) {
      return res.status(400).json({ error: "OTP expired or not requested." });
    }

    if (user.otp !== otp || user.otp_type !== "reset") {
      return res.status(400).json({ error: "Invalid OTP." });
    }

    await knex("users")
      .where({ email })
      .update({
        otp: null,
        otp_type: "",
        otp_expires: null,
        reset_verified: true,
        reset_verified_expires: new Date(Date.now() + 15 * 60 * 1000),
      });

    res.json({ message: "OTP verified successfully." });
  } catch (error) {
    console.error("Verify forgot password error:", error);
    res.status(500).json({ error: "Server error. Try again later." });
  }
};

const resetForgotPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const user = await knex("users").where({ email }).first();
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (
      !user.reset_verified ||
      !user.reset_verified_expires ||
      Date.now() > new Date(user.reset_verified_expires).getTime()
    ) {
      return res.status(403).json({
        error: "OTP verification required before resetting password.",
      });
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters long, include uppercase, lowercase, number, and special character.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash(newPassword, salt);

    await knex("users").where({ email }).update({
      password,
      reset_verified: false,
      reset_verified_expires: null,
      updated_at: new Date(),
    });

    res.json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Reset forgot password error:", error);
    res.status(500).json({ error: "Server error. Try again later." });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await knex("users")
      .where({ otp: token, otp_type: "reset" })
      .whereNotNull("otp_expires")
      .where("otp_expires", ">", new Date())
      .first();

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset token." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await knex("users").where({ id: user.id }).update({
      password: hashedPassword,
      otp: null,
      otp_expires: null,
      otp_type: "",
      updated_at: new Date(),
    });

    res.json({ message: "Password reset successful. You can now log in." });
  } catch (error) {
    await logActivity({
      userId: req?.user?.id ?? null,
      action: "forget_password_error",
      description: `Unexpected server error during forget password: ${error.message}`,
      req,
    });
    res.status(500).json({ error: "Server error. Try again later." });
  }
};

const requestChangePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await knex("users").where({ id: req.user.id }).first();
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Old password is incorrect." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await knex("users")
      .where({ id: user.id })
      .update({
        pending_password: hashedNewPassword,
        otp,
        otp_type: "change",
        otp_expires: new Date(Date.now() + 10 * 60 * 1000),
        updated_at: new Date(),
      });

    const subject = "Password Change OTP";
    const htmlContent = `
      <p>Hello ${user.first_name || "User"},</p>
      <p>You requested a password change. Use the OTP below to confirm:</p>
      <p><b>${otp}</b></p>
      <p>If you didn't request this, you can ignore this email.</p>
      <p>OTP expires in 10 minutes.</p>
    `;

    try {
      await sendEmail(user.email, subject, htmlContent);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    res.json({
      message: "OTP sent. Please verify to complete password change.",
    });
  } catch (error) {
    console.error("Request change password error:", error);
    res.status(500).json({ error: "Server error. Try again later." });
  }
};

const verifyChangePassword = async (req, res) => {
  try {
    const { otp } = req.body;

    const user = await knex("users").where({ id: req.user.id }).first();
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (
      !user.otp ||
      !user.otp_expires ||
      Date.now() > new Date(user.otp_expires).getTime()
    ) {
      return res.status(400).json({ error: "OTP expired or not requested." });
    }

    if (user.otp !== otp || user.otp_type !== "change") {
      return res.status(400).json({ error: "Invalid OTP." });
    }

    await knex("users").where({ id: user.id }).update({
      password: user.pending_password,
      pending_password: null,
      otp: null,
      otp_expires: null,
      otp_type: "",
      updated_at: new Date(),
    });

    res.json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Verify change password error:", error);
    res.status(500).json({ error: "Server error. Try again later." });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await knex("users").where({ id: req.user.id }).first();
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Old password is incorrect." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await knex("users").where({ id: user.id }).update({
      password: hashedPassword,
      updated_at: new Date(),
    });

    await logActivity({
      userId: user.id,
      action: "password_change",
      description: "User changed password successfully.",
      req,
    });

    res.json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Server error. Try again later." });
  }
};

const biometricLogin = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ message: "Email is required for biometric login" });
    }

    const user = await knex("users").where({ email }).first();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.biometric_preference === "None") {
      return res
        .status(403)
        .json({ message: "Biometric login is not enabled for this user" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res
      .status(200)
      .json({ message: "Biometric login successful", token, user });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const generateAddress = (prefix) => {
  const hex = crypto.randomBytes(20).toString("hex");
  return `${prefix}_0x${hex}`;
};

const verifyAccountOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await knex("users").where({ email }).first();
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (
      !user.otp ||
      user.otp_type !== "signup" ||
      Date.now() > new Date(user.otp_expires).getTime()
    ) {
      return res.status(400).json({ error: "OTP expired or invalid." });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ error: "Incorrect OTP." });
    }

    await knex.transaction(async (trx) => {
      // 1. Update User
      await trx("users").where({ id: user.id }).update({
        verified: true,
        otp: null,
        otp_type: null,
        otp_expires: null,
        updated_at: new Date(),
      });

      const walletLayers = [
        {
          user_id: user.id,
          wallet_type: "FIAT",
          currency_code: "NGN",
          wallet_address_name: `${user.first_name} ${user.last_name}`,
          status: "inactive",
        },
        {
          user_id: user.id,
          wallet_type: "FIAT",
          currency_code: "USD",
          wallet_address_name: `${user.first_name} ${user.last_name}`,
          status: "inactive",
        },
        {
          user_id: user.id,
          wallet_type: "TRADEBITS",
          currency_code: "TBT",
          wallet_address: generateAddress("TBT"),
          status: "active",
        },
        {
          user_id: user.id,
          wallet_type: "CREDIX",
          currency_code: "CRX",
          wallet_address: generateAddress("CRX"),
          status: "active",
        },
      ];

      console.log("Inserting wallet layers...");
      await trx("wallets").insert(walletLayers);
    });

    return res.status(200).json({
      message: "Account verified and wallets initialized successfully.",
      user: {
        id: user.id,
        email: user.email,
        verified: true,
      },
    });
  } catch (err) {
    console.error("Verify OTP error (Transaction Rolled Back):", err);
    // If we already sent a response, don't try to send another
    if (res.headersSent) return;

    return res.status(500).json({
      error: "Server error. Wallet initialization failed.",
      details: err.message, // Useful for debugging while you build
    });
  }
};

const resendAccountOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await knex("users").where({ email }).first();
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (user.verified) {
      return res.status(400).json({ error: "Account is already verified." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await knex("users")
      .where({ id: user.id })
      .update({
        otp,
        otp_type: "signup",
        otp_expires: new Date(Date.now() + 10 * 60 * 1000),
        updated_at: new Date(),
      });

    const subject = "Resend Account Verification OTP";
    const htmlContent = `
      <p>Hello ${user.first_name || "User"},</p>
      <p>Here is your new OTP Code for account verification:</p>
      <p><b>${otp}</b></p>
      <p>If you didn't request this, ignore this email.</p>
      <p>Code expires in 10 minutes.</p>
    `;

    try {
      await sendEmail(user.email, subject, htmlContent);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    res.json({ message: "New OTP sent to your email." });
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ error: "Server error. Try again later." });
  }
};

const suggestUsernames = async (req, res) => {
  try {
    const { desiredUsername, email, first_name, last_name } = req.body;

    if (!desiredUsername) {
      return res.status(400).json({ error: "desiredUsername is required." });
    }

    const base = desiredUsername.replace(/[^a-zA-Z0-9]/g, "");
    if (base.length < 3 || base.length > 20) {
      return res.json({ available: false, suggestions: [] });
    }

    const isTaken = await knex("users").where({ username: base }).first();

    const suggestions = [];
    if (!isTaken) suggestions.push(base);

    let candidates = [base];

    if (email) {
      const emailBase = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
      if (emailBase.length >= 3 && emailBase.length <= 20) {
        candidates.push(emailBase);
      }
    }

    if (first_name) candidates.push(first_name.replace(/[^a-zA-Z0-9]/g, ""));
    if (last_name) candidates.push(last_name.replace(/[^a-zA-Z0-9]/g, ""));

    while (suggestions.length < 5) {
      const candidate =
        candidates[Math.floor(Math.random() * candidates.length)];
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const suggestion = `${candidate}${randomSuffix}`;

      if (suggestion.length <= 20) {
        const exists = await knex("users")
          .where({ username: suggestion })
          .first();
        if (!exists && !suggestions.includes(suggestion)) {
          suggestions.push(suggestion);
        }
      }
    }

    res.json({ available: !isTaken, suggestions });
  } catch (err) {
    console.error("Username suggestion error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

const toggleSmartReply = async (req, res) => {
  try {
    const userId = req.user.id;
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ msg: "enabled must be true or false" });
    }

    const [user] = await knex("users")
      .where({ id: userId })
      .update({ smart_reply_enabled: enabled, updated_at: new Date() })
      .returning(["id", "username", "email", "smart_reply_enabled"]);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json({
      msg: `Smart reply has been ${enabled ? "enabled" : "disabled"}`,
      user,
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

const checkEmailAvailability = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const existingUser = await knex("users").where({ email }).first();

    if (existingUser) {
      return res.json({ available: false, message: "Email is already taken." });
    }

    return res.json({ available: true, message: "Email is available." });
  } catch (error) {
    console.error("Check email availability error:", error);
    res.status(500).json({ error: "Server error. Try again later." });
  }
};

const checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }

    const cleanUsername = username.replace(/[^a-zA-Z0-9]/g, "");

    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      return res.status(400).json({
        available: false,
        message: "Username must be between 3 and 20 characters.",
      });
    }

    const existingUser = await knex("users")
      .where({ username: cleanUsername })
      .first();

    if (existingUser) {
      return res.json({
        available: false,
        message: "Username is already taken.",
      });
    }

    return res.json({ available: true, message: "Username is available." });
  } catch (error) {
    console.error("Check username availability error:", error);
    res.status(500).json({ error: "Server error. Try again later." });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      first_name,
      middle_name,
      last_name,
      dob,
      gender,
      biometricPreference,
    } = req.body;

    const user = await knex("users").where({ id: userId }).first();
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const updates = { updated_at: new Date() };

    if (first_name) updates.first_name = first_name;
    if (middle_name) updates.middle_name = middle_name;
    if (last_name) updates.last_name = last_name;
    if (dob) updates.dob = new Date(dob);
    if (gender) updates.gender = gender;
    if (biometricPreference) updates.biometric_preference = biometricPreference;

    const [updatedUser] = await knex("users")
      .where({ id: userId })
      .update(updates)
      .returning("*");

    return res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Server error. Try again later." });
  }
};

const getOnlineUsers = async (req, res) => {
  try {
    const users = await knex("users")
      .where({ is_online: true })
      .select(
        "first_name",
        "last_name",
        "username",
        "email",
        "is_online",
        "last_seen",
      );

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Error fetching online users" });
  }
};

const getUserLastSeen = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await knex("users")
      .where({ id })
      .select("username", "is_online", "last_seen")
      .first();

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user last seen" });
  }
};
module.exports = {
  signup,
  login,
  forgotPassword,
  resetPassword,
  verifyForgetPasswordOtp,
  resetForgotPassword,
  checkEmailAvailability,
  checkUsernameAvailability,
  changePassword,
  biometricLogin,
  requestChangePassword,
  verifyChangePassword,
  verifyAccountOtp,
  resendAccountOtp,
  suggestUsernames,
  toggleSmartReply,
  updateProfile,
  getUserLastSeen,
  getOnlineUsers,
  generateOTPTemplate,
  getUser,
};
