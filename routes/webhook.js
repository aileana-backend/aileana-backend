const express = require("express");
const router = express.Router();

const { handleWebhookRequest } = require("../controllers/webHookController");

// Webhook route
router.post("/webhook", handleWebhookRequest);

module.exports = router;
