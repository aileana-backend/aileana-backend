const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const { createWallet } = require("../middleware/utils/onepipe");

const PROVIDER_CODE = process.env.ONEPIPE_PROVIDER_CODE || "FidelityVirtual";
const PROVIDER_NAME = process.env.ONEPIPE_PROVIDER_NAME || "FidelityVirtual";

// ==== SIGNUP ====
const signup = async (req, res) => {
  try {
    const {
      firstname,
      middlename,
      surname,
      name,
      email,
      phone,
      avatar,
      dob,
      gender,
      title,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      password,
    } = req.body;

    // Check if user exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ msg: "Email already registered" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      firstname,
      middlename,
      surname,
      name,
      email,
      phone,
      avatar,
      dob,
      gender,
      title,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      password: hashed,
    });
    await user.save();

    // Wallet payload for OnePipe
    const walletUserData = {
      _id: user._id,
      customer_ref: `user_${user._id}`,
      firstname,
      surname,
      email,
      mobile_no: phone,
      provider_code: PROVIDER_CODE,
      provider_name: PROVIDER_NAME,
      account_type: "static",
    };

    // Create wallet
    const walletResponse = await createWallet(walletUserData);

    if (walletResponse.status === "Successful") {
      const wallet = new Wallet({
        user: user._id,
        externalId:
          walletResponse.data?.provider_response?.account_number ||
          walletResponse.data?.externalId,
        balance: 0,
        currency: walletResponse.data?.provider_response?.currency || "NGN",
      });
      await wallet.save();
    }

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    res.status(201).json({
      token,
      user,
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
        customer_ref: `user_${user._id}`,
        firstname: user.firstname,
        surname: user.surname,
        email: user.email,
        mobile_no: user.phone,
        provider_code: PROVIDER_CODE,
        provider_name: PROVIDER_NAME,
        account_type: "static",
      };

      const walletResponse = await createWallet(walletUserData);

      if (walletResponse.status === "Successful") {
        wallet = new Wallet({
          user: user._id,
          externalId:
            walletResponse.data?.provider_response?.account_number ||
            walletResponse.data?.externalId,
          balance: 0,
          currency: walletResponse.data?.provider_response?.currency || "NGN",
        });
        await wallet.save();
      }
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    res.json({
      token,
      user,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

module.exports = { signup, login };
