const logActivity = require("../../utils/activityLogger");
const { verifyWebhook } = require("../../utils/webhookVerifyer");
const transactionService = require("../services/transaction.service");
const walletService = require("../services/wallet.service");

const handleWebhookRequest = async (req, res, next) => {
  try {
    // 1️⃣ Get Monnify request signature
    const signature = req.headers["monnify-signature"];
    const monnifySecretKey = process.env.MONNIFY_SECRET_KEY;

    // 2️⃣ Get raw body for signature verification
    const rawBody = req.rawBody || "";
    const event = req.body || {};

    // if (
    //   !signature ||
    //   !monnifySecretKey ||
    //   !rawBody ||
    //   Object.keys(event).length === 0
    // ) {
    //   return res.status(400).json({ msg: "Bad Request" });
    // }

    // 3️⃣ Verify the webhook signature
    // const isValid = verifyWebhook(rawBody, signature, monnifySecretKey);
    // if (!isValid) {
    //   return res.status(401).json({ msg: "Unauthorized" });
    // }

    // 4️⃣ Get event type and data
    const eventData = event.eventData || false;
    const eventType = event.eventType || false;

    if (!eventData || !eventType) {
      return res.status(400).json({ msg: "Invalid webhook data" });
    }

    switch (eventType) {
      case "VA_TRANSACTION": // Monnify virtual account funding
        // Extract userId from VA reference (ensure you encode userId when creating VA)
        const userId = eventData.reference?.replace("AILEANA_", "") || null;
        if (!userId) {
          return res
            .status(400)
            .json({ msg: "Invalid user reference in webhook data" });
        }

        // Get the user wallet
        const userWallet = await new walletService(null).findByUserId(userId);
        if (!userWallet) {
          return res.status(404).json({ msg: "User wallet not found" });
        }

        // Prevent duplicate transaction
        const existingTransaction =
          await transactionService.getTransactionByReference(
            eventData.transactionReference,
          );
        if (existingTransaction) {
          return res.status(200).json({ msg: "Transaction already processed" });
        }

        // Credit wallet
        const charges =
          Number(eventData?.amountPaid) - Number(eventData?.settlementAmount);
        const toBeCredited = Number(eventData?.settlementAmount);
        const creditTrnx = await new walletService(null).creditWallet(
          userWallet.id,
          toBeCredited,
          charges,
          eventData?.transactionReference,
          "Wallet Top-up",
          {
            rawEventData: eventData,
            creditedBy: "monnify_webhook",
          },
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

      default:
        // Ignore other events
        return res.status(200).json({ msg: "Event type ignored" });
    }

    res.status(200).json({ msg: "Webhook processed successfully" });
  } catch (error) {
    next(error);
    await logActivity({
      userId: null,
      action: "webhook_error",
      description: `Unexpected server error during webhook processing: ${error.message}`,
      req,
    });

    // res.status(500).json({ msg: "Server error", err: error.message });
  }
};

module.exports = {
  handleWebhookRequest,
};
