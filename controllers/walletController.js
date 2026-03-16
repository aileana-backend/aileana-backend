const express = require("express");
const walletService = require("../wallet/services/wallet.service");
const knex = require("../config/pg"); // your knex instance

const initiateNairaWalletKYC = async (req, res, next) => {
  try {
    const { success, status, message, data } = await new walletService(
      req.user,
    ).initiateNairaWalletKYC(req.body);
    if (!success)
      return res.status(status).json({ success: false, message, data });
    res.json({ success, message, data });
  } catch (err) {
    next(err);
  }
};

const getWallet = async (req, res, next) => {
  try {
    const { success, status, message, data } = await new walletService(
      req.user,
    ).getWallet();
    if (!success)
      return res.status(status).json({ success: false, message, data });
    res.json({ success, message, data });
  } catch (err) {
    next(err);
  }
};

const validateBankAccount = async (req, res, next) => {
  try {
    const { accountNumber, bankCode } = req.query;
    const { success, status, message, data } = await new walletService(
      req.user,
    ).validateBankAccount(accountNumber, bankCode);
    if (!success)
      return res.status(status).json({ success: false, message, data });
    res.json({ success, message, data });
  } catch (err) {
    next(err);
  }
};

const transferfunds = async (req, res, next) => {
  try {
    const { success, status, message, data } = await new walletService(
      req.user,
    ).transferFunds(req.body);
    if (!success)
      return res.status(status).json({ success: false, message, data });
    res.json({ success, message, data });
  } catch (err) {
    next(err);
  }
};

const getAllCreatedWallets = async (req, res, next) => {
  try {
    const { currency } = req.query;
    const { success, status, message, data } = await new walletService(
      req.user,
    ).getAllCreatedWallets(currency);
    if (!success)
      return res.status(status).json({ success: false, message, data });
    res.json({ success, message, data });
  } catch (err) {
    next(err);
  }
};

const transferP2P = async (req, res, next) => {
  try {
    const { walletId } = req.params;
    const { receiverWalletId } = req.query;
    const { amount } = req.body;
    const { success, status, message, data } = await new walletService(
      req.user,
    ).transferP2P({ walletId, receiverWalletId, amount });
    if (!success)
      return res.status(status).json({ success: false, message, data });
    res.json({ success, message, data });
  } catch (err) {
    next(err);
  }
};

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const validateBvn = async (req, res, next) => {
  try {
    let { bvn, dateOfBirth, name, mobileNo } = req.body;

    if (!bvn || !dateOfBirth || !name || !mobileNo) {
      return res.status(400).json({
        success: false,
        message: "BVN, DOB, MOBILE NUMBER and Full Name are required",
        data: null,
      });
    }

    if (!/^\d{11}$/.test(bvn)) {
      return res.status(400).json({
        success: false,
        message: "BVN must be exactly 11 digits",
        data: null,
      });
    }

    let dobObj = new Date(dateOfBirth);
    if (isNaN(dobObj)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD or a valid date.",
        data: null,
      });
    }

    const day = String(dobObj.getDate()).padStart(2, "0");
    const month = months[dobObj.getMonth()];
    const year = dobObj.getFullYear();
    req.body.dateOfBirth = `${day}-${month}-${year}`;

    const { success, status, message, data } = await new walletService(
      req.user,
    ).validateBvn(req.body);
    if (!success)
      return res.status(status || 500).json({ success: false, message, data });
    res.json({ success, message, data });
  } catch (err) {
    next(err);
  }
};

// ── Switched from MongoDB User.findOne to knex ──
const verifyNairaWalletKycOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const user = await knex("users").where({ email }).first();
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    console.log(user.otp, otp);
    console.log(user.otp === otp);

    if (user.otp !== otp) {
      return res.status(400).json({ success: false, message: "Incorrect OTP" });
    }

    // Check OTP expiry
    if (user.otp_expires && new Date() > new Date(user.otp_expires)) {
      return res
        .status(400)
        .json({ success: false, message: "OTP has expired" });
    }

    // Clear OTP fields
    await knex("users").where({ email }).update({
      otp: null,
      otp_type: null,
      otp_expires: null,
      updated_at: new Date(),
    });

    res.json({
      success: true,
      message: "Account verified and KYC verified successfully",
      data: { id: user.id, email: user.email },
    });
  } catch (err) {
    next(err);
  }
};

const uploadKYCDocument = async (req, res, next) => {
  try {
    const { id_type, id_number } = req.body;

    if (!req.files?.id_image || !req.files?.selfie) {
      return res.status(400).json({
        success: false,
        message: "Both ID image and selfie are required",
      });
    }

    const result = await new walletService(req.user).uploadIDDocument({
      id_type,
      id_number,
      file: req.files.id_image[0],
      selfie: req.files.selfie[0],
    });

    return res.status(200).json({
      success: true,
      message: "Verification submitted successfully",
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

// ── Switched from MongoDB User.updateOne to knex ──
const handleSmileWebhook = async (req, res, next) => {
  try {
    const { ResultCode, ResultText, PartnerParams } = req.body;
    const { user_id, job_id } = PartnerParams;

    const isVerified = ResultCode === "0810";

    await knex("users")
      .where({ id: user_id })
      .update({
        kyc_status: isVerified ? "verified" : "rejected",
        kyc_rejection_reason: isVerified ? null : ResultText,
        kyc_completed: isVerified,
        kyc_job_id: job_id,
        updated_at: new Date(),
      });

    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

const getWalletByType = async (req, res, next) => {
  try {
    const { type, subtype } = req.query;
    const result = await new walletService(req.user).getWalletByType(
      type,
      subtype,
    );
    return res.status(result.status).json(result);
  } catch (error) {
    next(error);
  }
};

const getBanks = async (req, res, next) => {
  try {
    const result = await new walletService(req.user).getBanks();
    return res.status(result.status).json(result);
  } catch (error) {
    next(error);
  }
};

const resolveAccount = async (req, res, next) => {
  try {
    const { account_number, bank_code } = req.body;
    const result = await new walletService(req.user).resolveAccount(
      account_number,
      bank_code,
    );
    return res.status(result.status).json(result);
  } catch (error) {
    next(error);
  }
};

const sendToExternalAccount = async (req, res, next) => {
  try {
    const { amount, accountNumber, bankCode, pin, narration, accountName } =
      req.body;
    const { success, status, message, data } = await new walletService(
      req.user,
    ).sendToExternalAccount({
      amount,
      accountNumber,
      accountName,
      bankCode,
      pin,
      narration,
    });
    if (!success)
      return res.status(status).json({ success: false, message, data });
    res.json({ success, message, data });
  } catch (err) {
    next(err);
  }
};

const getTransferStatus = async (req, res, next) => {
  try {
    const { reference } = req.params;
    const { success, status, message, data } = await new walletService(
      req.user,
    ).getTransferStatus({
      reference,
    });

    if (!success)
      return res.status(status).json({ success: false, message, data });
    res.json({ success, message, data });
  } catch (err) {
    next(err);
  }
};

const getReceiveFundsDetails = async (req, res, next) => {
  try {
    const { success, status, message, data } = await new walletService(
      req.user,
    ).getReceiveFundsDetails();

    if (!success)
      return res.status(status).json({ success: false, message, data });

    return res.status(status).json({ success, message, data });
  } catch (error) {
    next(error);
  }
};

const addPin = async (req, res, next) => {
  try {
    const { pin } = req.body;
    const { success, status, message, data } = await new walletService(
      req.user,
    ).addPin(pin);

    if (!success)
      return res.status(status).json({ success: false, message, data });

    console.log(data);

    res.json({ success, message, data });
  } catch (error) {
    next(error);
  }
};

const verifyTradebitAddress = async (req, res, next) => {
  try {
    const { address } = req.body;
    const { success, status, message, data } = await new walletService(
      req.user,
    ).verifyTradebitAddress(address);

    if (!success)
      return res.status(status).json({ success: false, message, data });

    res.status(status).json({ success, message, data });
  } catch (error) {
    next(error);
  }
};

const getTradebitsBalance = async (req, res, next) => {
  try {
    const { success, status, message, data } = await new walletService(
      req.user,
    ).getTradebitBalance();

    if (!success)
      return res.status(status).json({ success: false, message, data });

    res.status(status).json({ success, message, data });
  } catch (error) {
    next(error);
  }
};

const transferTradebits = async (req, res, next) => {
  try {
    const { amount, recipientAddress, pin, isAnnonymous } = req.body;
    const { success, status, message, data } = await new walletService(
      req.user,
    ).transferTradebits(recipientAddress, amount, pin, isAnnonymous);

    if (!success)
      return res.status(status).json({ success: false, message, data });

    res.status(status).json({ success, message, data });
  } catch (error) {
    next(error);
  }
};

const previewTradebitFee = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const { success, status, message, data } = await new walletService(
      req.user,
    ).previewTradebitsFee(amount);

    if (!success)
      return res.status(status).json({ success: false, message, data });

    res.status(status).json({ success, message, data });
  } catch (error) {
    next(error);
  }
};

const tradebitTransaction = async (req, res) => {
  try {
    const { reference } = req.params;
    const result = await new walletService(req.user).tradebitTransaction(
      reference,
    );

    if (!result.success) {
      return res.status(result.status || 404).json({
        message: result.message || "Transaction not found",
      });
    }

    return res.status(200).json(result.data);
  } catch (error) {
    console.error("Controller Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getTradebitHistory = async (req, res) => {
  try {
    const result = await new walletService(req.user).getTradebitHistory();
    return res
      .status(result.status)
      .json(result.data || { message: result.message });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getTradebitHistory,
  tradebitTransaction,
  previewTradebitFee,
  transferTradebits,
  getTradebitsBalance,
  verifyTradebitAddress,
  addPin,
  getReceiveFundsDetails,
  getTransferStatus,
  sendToExternalAccount,
  resolveAccount,
  getBanks,
  getWalletByType,
  uploadKYCDocument,
  verifyNairaWalletKycOtp,
  getWallet,
  transferfunds,
  transferP2P,
  getAllCreatedWallets,
  validateBvn,
  validateBankAccount,
  handleSmileWebhook,
  initiateNairaWalletKYC,
};
