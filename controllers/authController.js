const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const validator = require("validator");
const logTransaction = require("../utils/transactionLogger");
const logActivity = require("../utils/activityLogger");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Store = require("../models/Store");
const Wallet = require("../models/Wallet");
const { createWallet } = require("../utils/onepipe");
const sendEmail = require("../utils/sendMail");

const PROVIDER_CODE = process.env.ONEPIPE_PROVIDER_CODE || "FidelityVirtual";
const PROVIDER_NAME = process.env.ONEPIPE_PROVIDER_NAME || "FidelityVirtual";

const signup = async (req, res) => {
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

    if (!termsAccepted) {
      return res
        .status(400)
        .json({ error: "You must accept the Terms & Conditions to register." });
    }

    if (!username || username.length < 3) {
      return res
        .status(400)
        .json({ error: "Username must be at least 3 characters long." });
    }
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ msg: "Username already taken." });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ msg: "Email already registered" });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: "Invalid email format." });
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters long, include uppercase, lowercase, number, and special character.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const user = new User({
      username,
      first_name,
      middle_name,
      last_name,
      email,
      dob,
      gender,
      password: hashedPassword,
      biometricPreference: biometricPreference || "None",
      termsAccepted: true,
      otp,
      otpType: "signup",
      otpExpires: Date.now() + 10 * 60 * 1000,
    });

    const newUser = await user.save();
    // create empty store for user
    const store = new Store({ owner: user._id });
    await store.save();

    // link store back to user
    newUser.store = store._id;
    await newUser.save();
    const subject = "Account verification OTP";
    const htmlContent = `
      <p>Hello ${newUser.first_name || "User"},</p>
      <p>Please use the OTP Code below to verify your account:</p>
      <p><b>${otp}</b></p>
      <p>If you didn’t request this, you can ignore this email.</p>
      <p>Link expires in 1 hour.</p>
    `;

    // // Wallet payload for OnePipe
    const walletUserData = {
      userId: newUser._id,
      //  customer_ref: `user_${user._id}`,
      //  first_name,
      //  middle_name,
      //  last_name,
      //  email,
      //mobile_no: phone,
      // provider_code: PROVIDER_CODE,
      //  provider_name: PROVIDER_NAME,
      //  account_type: "static",
    };
    // // Create wallet
    // const walletResponse = await createWallet(walletUserData);
    const wallet = new Wallet({
      userId: newUser._id,
    });
    await wallet.save();
    await logTransaction({
      user: newUser._id,
      wallet: wallet._id,
      type: "wallet_created",
      amount: 0,
      currency: "naira",
    });
    await logActivity({
      userId: newUser._id,
      action: "signup",
      description: "New user signed up and OTP sent.",
      req,
    });

    // if (walletResponse.status === "Successful") {
    //   const existingWallet = await Wallet.findOne({
    //     userId: walletUserData.userId,
    //   });
    //   if (!existingWallet) {
    //     const wallet = new Wallet({
    //       userId: newUser._id,
    //       // externalId:
    //       //   walletResponse.data?.provider_response?.account_number ||
    //       //   walletResponse.data?.externalId,
    //       // balance: 0,
    //       // currency: walletResponse.data?.provider_response?.currency || "NGN",
    //     });
    //     await wallet.save();
    //   }
    // }
    // Generate token
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    try {
      await sendEmail(user.email, subject, htmlContent);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    res.status(201).json({
      token,
      newUser,
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    let wallet = await Wallet.findOne({ user: user._id });
    if (!wallet) {
      const walletUserData = {
        _id: user._id,
        // customer_ref: `user_${user._id}`,
        // firstname: user.firstname,
        // surname: user.surname,
        // email: user.email,
        // mobile_no: user.phone,
        // provider_code: PROVIDER_CODE,
        // provider_name: PROVIDER_NAME,
        // account_type: "static",
      };

      //   const walletResponse = await createWallet(walletUserData);

      // if (walletResponse.status === "Successful") {
      //   wallet = new Wallet({
      //     user: user._id,
      //     externalId:
      //       walletResponse.data?.provider_response?.account_number ||
      //       walletResponse.data?.externalId,
      //     balance: 0,
      //     currency: walletResponse.data?.provider_response?.currency || "NGN",
      //   });
      //   await wallet.save();
      // }
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });
    console.log(user._id);
    await logActivity({
      userId: user._id,
      action: "login",
      description: "User logged in successfully.",
      req,
    });

    res.json({
      token,
      user,
    });
  } catch (err) {
    await logActivity({
      userId: null,
      action: "login_error",
      description: `Unexpected server error during login: ${err.message}`,
      req,
    });

    res.status(500).json({ msg: "Server error", err: err.message });
  }
};
// const forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(404).json({ error: "No account with that email." });
//     }

//     // Generate reset token
//     const token = crypto.randomBytes(32).toString("hex");

//     user.otp = token;
//     user.otpExpires = Date.now() + 3600000; // 1 hour validity
//     user.otpType = "reset";
//     await user.save();

//     const resetLink = `http://frontend_needs_to_give_me_a_link.com/reset-password/${token}`;
//     const subject = "Password Reset Request";
//     const htmlContent = `
//       <p>Hello ${user.first_name || "User"},</p>
//       <p>You requested a password reset. Click below to reset:</p>
//       <a href="${resetLink}" target="_blank">${resetLink}</a>
//       <p>If you didn’t request this, you can ignore this email.</p>
//       <p>Link expires in 1 hour.</p>
//     `;

//     try {
//       await sendEmail(user.email, subject, htmlContent);
//     } catch (emailError) {
//       console.error("Email sending failed:", emailError);
//     }

//     res.json({
//       message: "Password reset link has been sent to your email.",
//       token,
//     }); // token returned for testing
//   } catch (error) {
//     console.error("Forgot password error:", error);
//     await logActivity({
//       userId: null,
//       action: "forget_password_error",
//       description: `Unexpected server error during forget password: ${err.message}`,
//       req,
//     });
//     res.status(500).json({ error: "Server error. Try again later." });
//   }
// };
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "No account with that email." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    user.otpType = "reset";
    await user.save();

    const subject = "Password Reset OTP";
    const htmlContent = `
      <p>Hello ${user.first_name || "User"},</p>
      <p>Your password reset OTP is:</p>
      <h2>${otp}</h2>
      <p>This OTP will expire in 10 minutes.</p>
      <p>If you didn’t request this, you can ignore this email.</p>
    `;

    try {
      await sendEmail(user.email, subject, htmlContent);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    res.json({
      message: "Password reset OTP has been sent to your email.",
    });
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

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (!user.otp || !user.otpExpires || Date.now() > user.otpExpires) {
      return res.status(400).json({ error: "OTP expired or not requested." });
    }

    if (user.otp !== otp || user.otpType !== "reset") {
      return res.status(400).json({ error: "Invalid OTP." });
    }

    // Commit pending password

    user.otp = null;
    user.otpType = "";
    user.otpExpires = null;
    user.resetVerified = true;
    user.resetVerifiedExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    await user.save();

    res.json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Verify forgot password error:", error);
    res.status(500).json({ error: "Server error. Try again later." });
  }
};

const resetForgotPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    if (
      !user.resetVerified ||
      !user.resetVerifiedExpires ||
      Date.now() > user.resetVerifiedExpires
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
    user.password = await bcrypt.hash(newPassword, salt);

    user.resetVerified = false;
    user.resetVerifiedExpires = null;

    await user.save();

    res.json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Reset forgot password error:", error);
    res.status(500).json({ error: "Server error. Try again later." });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
      otpType: "reset",
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset token." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpType = "";
    await user.save();

    res.json({ message: "Password reset successful. You can now log in." });
  } catch (error) {
    await logActivity({
      userId: req?.user?._id ?? null,
      action: "forget_password_error",
      description: `Unexpected server error during forget password: ${err.message}`,
      req,
    });
    res.status(500).json({ error: "Server error. Try again later." });
  }
};

const requestChangePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Old password is incorrect." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.pendingPassword = hashedNewPassword;
    user.otp = otp;
    user.otpType = "change";
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    console.log("Generated OTP:", otp);
    const subject = "Password Reset OTP";
    const htmlContent = `
      <p>Hello ${user.first_name || "User"},</p>
      <p>You requested a password reset. Use the otp below to reset:</p>
      <p><b>${otp}</b></p>
      <p>If you didn’t request this, you can ignore this email.</p>
      <p>Link expires in 1 hour.</p>
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

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (!user.otp || !user.otpExpires || Date.now() > user.otpExpires) {
      return res.status(400).json({ error: "OTP expired or not requested." });
    }

    if (user.otp !== otp || user.otpType !== "change") {
      return res.status(400).json({ error: "Invalid OTP." });
    }

    user.password = user.pendingPassword;
    user.pendingPassword = undefined;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpType = "";

    await user.save();

    res.json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Verify change password error:", error);
    res.status(500).json({ error: "Server error. Try again later." });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Old password is incorrect." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password changed successfully." });
    await logActivity({
      userId: user._id,
      action: "password_change",
      description: "User requested password change OTP.",
      req,
    });
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

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.biometricPreference === "None") {
      return res
        .status(403)
        .json({ message: "Biometric login is not enabled for this user" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Biometric login successful",
      token,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
const verifyAccountOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Check OTP validity
    if (
      !user.otp ||
      user.otpType !== "signup" ||
      Date.now() > user.otpExpires
    ) {
      return res.status(400).json({ error: "OTP expired or invalid." });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ error: "Incorrect OTP." });
    }

    user.verified = true;
    user.otp = undefined;
    user.otpType = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({ message: "Account verified successfully." });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ error: "Server error. Try again later." });
  }
};
const resendAccountOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: "Account is already verified." });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpType = "signup";
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    const subject = "Resend Account Verification OTP";
    const htmlContent = `
      <p>Hello ${user.first_name || "User"},</p>
      <p>Here is your new OTP Code for account verification:</p>
      <p><b>${otp}</b></p>
      <p>If you didn’t request this, ignore this email.</p>
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
      return res.json({
        available: false,
        suggestions: [],
      });
    }

    const isTaken = await User.findOne({ username: base });

    const suggestions = [];

    if (!isTaken) {
      suggestions.push(base);
    }

    let candidates = [base];

    if (email) {
      const emailBase = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
      if (emailBase.length >= 3 && emailBase.length <= 20) {
        candidates.push(emailBase);
      }
    }

    if (first_name) {
      candidates.push(first_name.replace(/[^a-zA-Z0-9]/g, ""));
    }
    if (last_name) {
      candidates.push(last_name.replace(/[^a-zA-Z0-9]/g, ""));
    }

    while (suggestions.length < 5) {
      const candidate =
        candidates[Math.floor(Math.random() * candidates.length)];
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const suggestion = `${candidate}${randomSuffix}`;

      if (suggestion.length <= 20) {
        const exists = await User.findOne({ username: suggestion });
        if (!exists && !suggestions.includes(suggestion)) {
          suggestions.push(suggestion);
        }
      }
    }

    res.json({
      available: !isTaken,
      suggestions,
    });
  } catch (err) {
    console.error("Username suggestion error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

const toggleSmartReply = async (req, res) => {
  try {
    const userId = req.user._id;
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ msg: "enabled must be true or false" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { smartReplyEnabled: enabled },
      { new: true, select: "username email smartReplyEnabled" }
    );

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

    const existingUser = await User.findOne({ email });

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

    const existingUser = await User.findOne({ username: cleanUsername });

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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (first_name) user.first_name = first_name;
    if (middle_name) user.middle_name = middle_name;
    if (last_name) user.last_name = last_name;
    if (dob) user.dob = new Date(dob);
    if (gender) user.gender = gender;
    if (biometricPreference) user.biometricPreference = biometricPreference;

    // Save changes
    await user.save();

    return res.json({
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Server error. Try again later." });
  }
};

const getOnlineUsers = async (req, res) => {
  try {
    const users = await User.find({ isOnline: true }).select(
      "first_name last_name username email isOnline lastSeen"
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Error fetching online users" });
  }
};
const getUserLastSeen = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("username isOnline lastSeen");
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
};
