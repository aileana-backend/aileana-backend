// src/modules/tradebits/tradebits.controller.js
const TradebitService = require("../wallet/services/tradebits.service");

const calculate = async (req, res, next) => {
  try {
    const { amount } = req.query;
    const data = await TradebitService.calculateTradebits(amount);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const initiatePurchase = async (req, res, next) => {
  try {
    const { nairaAmount, paymentMethod } = req.body;
    const data = await TradebitService.initiatePurchase(
      req.user.id,
      nairaAmount,
      paymentMethod,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const confirmPurchase = async (req, res, next) => {
  try {
    const { nairaAmount, paymentMethod, pin } = req.body;
    const data = await TradebitService.confirmPurchase(
      req.user.id,
      nairaAmount,
      paymentMethod,
      pin,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const previewFee = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const data = await TradebitService.previewFee(amount);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const verifyAddress = async (req, res, next) => {
  try {
    const { address } = req.body;
    const data = await TradebitService.verifyAddress(address);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

const confirmSend = async (req, res, next) => {
  try {
    const { recipientAddress, amount, isAnonymous, pin } = req.body;
    const data = await TradebitService.confirmSend(
      req.user.id,
      recipientAddress,
      amount,
      isAnonymous,
      pin,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getBalance = async (req, res, next) => {
  try {
    const data = await TradebitService.getBalance(req.user.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getTransaction = async (req, res, next) => {
  try {
    const { reference } = req.params;
    const data = await TradebitService.getTransaction(req.user.id, reference);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTransaction,
  calculate,
  initiatePurchase,
  confirmPurchase,
  previewFee,
  verifyAddress,
  confirmSend,
  getBalance,
};
