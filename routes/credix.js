const express = require("express");
const { auth } = require("../middleware/auth");
const { getBalance, getAvailableTasks, getHistory } = require("../controllers/credixController");

const router = express.Router();

router.get("/credix/balance", auth, getBalance);
router.get("/credix/tasks", auth, getAvailableTasks);
router.get("/credix/history", auth, getHistory);

module.exports = router;
