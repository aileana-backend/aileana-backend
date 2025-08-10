const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { startCall, endCall } = require("../controllers/callController");

router.post("/call/start", auth, startCall);
router.post("/call/end", auth, endCall);

module.exports = router;
