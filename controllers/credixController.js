const credixService = require("../wallet/services/credix.service");

// GET /api/credix/balance
const getBalance = async (req, res, next) => {
  try {
    const data = await credixService.getBalance(req.user.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// GET /api/credix/tasks
const getAvailableTasks = async (req, res, next) => {
  try {
    const data = await credixService.getAvailableTasks();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// GET /api/credix/history
const getHistory = async (req, res, next) => {
  try {
    const data = await credixService.getHistory(req.user.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { getBalance, getAvailableTasks, getHistory };
