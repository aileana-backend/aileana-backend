const logActivity = require("../utils/activityLogger");
const { verifyWebhook } = require("../utils/webhookVerifyer");
const transactionService = require("../services/wallet/transaction.service");
const walletService = require("../services/wallet/wallet.service");
const handleWebhookRequest = async (req, res) => {
  try {
    // Get monnify request signature
    const signature = req.headers["monnify-signature"];
    // Get monnify secret key from environment variables
    const monnifySecretKey = process.env.MONNIFY_SECRET_KEY;

    // Get raw body for signature verification
    const rawBody = req.rawBody || "";
    const event = req.body || {};

    if (
      !signature ||
      !monnifySecretKey ||
      !rawBody ||
      Object.keys(event).length === 0
    ) {
      return res.status(400).json({ msg: "Bad Request" });
    }

    // Verify the webhook signature
    const isValid = verifyWebhook(rawBody, signature, monnifySecretKey);

    // Validate the signature
    if (!isValid) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    // Let's get the event data and type
    const eventData = event.eventData || false;
    const eventType = event.eventType || false;
    if (!eventData || !eventType) {
      return res.status(400).json({ msg: "Invalid webhook data" });
    }

    switch (eventType) {
      // handle user wallet top-up via monnify dedicated account
      case "SUCCESSFUL_TRANSACTION":
        // Get user ID
        const userId =
          eventData.product?.reference?.replace("AILEANA_", "") || null;
        if (!userId) {
          return res
            .status(400)
            .json({ msg: "Invalid user reference in webhook data" });
        }

        // Get the user wallet
        const userWallet = await walletService.findByUserId(userId);
        if (!userWallet) {
          return res.status(404).json({ msg: "User wallet not found" });
        }

        // Check if transaction is already processed
        const existingTransaction =
          await transactionService.getTransactionByReference(
            eventData.transactionReference
          );
        if (existingTransaction) {
          return res.status(200).json({ msg: "Transaction already processed" });
        }

        // Credit user wallet
        const charges =
          Number(eventData?.amountPaid) - Number(eventData?.settlementAmount);
        const toBeCredited = Number(eventData?.settlementAmount);
        const creditTrnx = await walletService.creditWallet(
          userWallet.id,
          toBeCredited,
          charges,
          eventData?.transactionReference,
          "Wallet Top-up",
          {
            rawEventData: eventData,
            creditedBy: "monnify_webhook",
          }
        );
        if (!creditTrnx) {
          await logActivity({
            userId,
            action: "wallet_credit_failed",
            description: `Failed to credit user wallet via webhook. Reference: ${eventData.transactionReference}`,
            req,
            event,
          });
          return res.status(500).json({ msg: "Failed to credit user wallet" });
        }

        await logActivity({
          userId,
          action: "wallet_credited",
          description: `User wallet credited with NGN${toBeCredited} via webhook. Reference: ${eventData.transactionReference}`,
          req,
          event,
        });
        break;
    }

    res.status(200).json({ msg: "Webhook processed successfully" });
  } catch (error) {
    await logActivity({
      userId: null,
      action: "webhook_error",
      description: `Unexpected server error during webhook processing: ${error.message}`,
      req,
    });

    res.status(500).json({ msg: "Server error", err: err.message });
  }
};

module.exports = {
  handleWebhookRequest,
};
