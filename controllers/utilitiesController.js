const UtilitiesService = require("../wallet/services/utilities.service");

// GET /api/utilities/categories?type=AIRTIME
const getBillCategories = async (req, res, next) => {
  try {
    const { type } = req.query;
    const { success, status, message, data } = await new UtilitiesService(
      req.user
    ).getBillCategories(type);

    if (!success) return res.status(status).json({ success, message });
    return res.status(status).json({ success, message, data });
  } catch (error) {
    next(error);
  }
};

// POST /api/utilities/validate-customer
// body: { item_code, customer }
const validateCustomer = async (req, res, next) => {
  try {
    const { item_code, customer } = req.body;

    if (!item_code || !customer) {
      return res.status(400).json({ success: false, message: "item_code and customer are required" });
    }

    const { success, status, message, data } = await new UtilitiesService(
      req.user
    ).validateCustomer(item_code, customer);

    if (!success) return res.status(status).json({ success, message });
    return res.status(status).json({ success, message, data });
  } catch (error) {
    next(error);
  }
};

// POST /api/utilities/buy-airtime
// body: { phone, amount, biller_name, pin }
const buyAirtime = async (req, res, next) => {
  try {
    const { phone, amount, biller_name, pin } = req.body;

    if (!phone || !amount || !biller_name || !pin) {
      return res.status(400).json({
        success: false,
        message: "phone, amount, biller_name, and pin are required",
      });
    }

    const { success, status, message, data } = await new UtilitiesService(
      req.user
    ).buyAirtime({ phone, amount: Number(amount), biller_name, pin });

    if (!success) return res.status(status).json({ success, message });
    return res.status(status).json({ success, message, data });
  } catch (error) {
    next(error);
  }
};

// POST /api/utilities/buy-data
// body: { phone, amount, biller_name, item_code, pin }
const buyData = async (req, res, next) => {
  try {
    const { phone, amount, biller_name, item_code, pin } = req.body;

    if (!phone || !amount || !biller_name || !item_code || !pin) {
      return res.status(400).json({
        success: false,
        message: "phone, amount, biller_name, item_code, and pin are required",
      });
    }

    const { success, status, message, data } = await new UtilitiesService(
      req.user
    ).buyData({ phone, amount: Number(amount), biller_name, item_code, pin });

    if (!success) return res.status(status).json({ success, message });
    return res.status(status).json({ success, message, data });
  } catch (error) {
    next(error);
  }
};

// POST /api/utilities/cable-tv
// body: { smartcard_number, amount, biller_name, item_code, pin }
const payCableTv = async (req, res, next) => {
  try {
    const { smartcard_number, amount, biller_name, item_code, pin } = req.body;

    if (!smartcard_number || !amount || !biller_name || !item_code || !pin) {
      return res.status(400).json({
        success: false,
        message: "smartcard_number, amount, biller_name, item_code, and pin are required",
      });
    }

    const { success, status, message, data } = await new UtilitiesService(
      req.user
    ).payCableTv({
      smartcard_number,
      amount: Number(amount),
      biller_name,
      item_code,
      pin,
    });

    if (!success) return res.status(status).json({ success, message });
    return res.status(status).json({ success, message, data });
  } catch (error) {
    next(error);
  }
};

// POST /api/utilities/electricity
// body: { meter_number, amount, meter_type, biller_name, item_code, pin }
const payElectricity = async (req, res, next) => {
  try {
    const { meter_number, amount, meter_type, biller_name, item_code, pin } = req.body;

    if (!meter_number || !amount || !meter_type || !biller_name || !item_code || !pin) {
      return res.status(400).json({
        success: false,
        message: "meter_number, amount, meter_type, biller_name, item_code, and pin are required",
      });
    }

    const { success, status, message, data } = await new UtilitiesService(
      req.user
    ).payElectricity({
      meter_number,
      amount: Number(amount),
      meter_type,
      biller_name,
      item_code,
      pin,
    });

    if (!success) return res.status(status).json({ success, message });
    return res.status(status).json({ success, message, data });
  } catch (error) {
    next(error);
  }
};

// GET /api/utilities/status/:reference
const getBillStatus = async (req, res, next) => {
  try {
    const { reference } = req.params;

    const { success, status, message, data } = await new UtilitiesService(
      req.user
    ).getBillStatus(reference);

    if (!success) return res.status(status).json({ success, message });
    return res.status(status).json({ success, message, data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBillCategories,
  validateCustomer,
  buyAirtime,
  buyData,
  payCableTv,
  payElectricity,
  getBillStatus,
};
