const logActivity = require("../../utils/activityLogger")
const { verifyWebhook } = require("../../utils/webhookVerifyer")

const handleWebhookRequest = async (req, res) => {
	try {
		// Get monnify request signature
		const signature = req.headers["monnify-signature"]
		// Get monnify secret key from environment variables
		const monnifySecretKey = process.env.MONNIFY_SECRET_KEY

		// Get raw body for signature verification
		const rawBody = req.rawBody || ""
		const event = req.body || {}

		if (!signature || !monnifySecretKey || !rawBody || Object.keys(event).length === 0) {
			return res.status(400).json({ msg: "Bad Request" })
		}

		// Verify the webhook signature
		const isValid = verifyWebhook(rawBody, signature, monnifySecretKey)

		// Validate the signature
		if (!isValid) {
			await logActivity({
				userId: null,
				action: "webhook_unauthorized",
				description: "Unauthorized webhook request due to invalid signature",
				req,
			})
			return res.status(401).json({ msg: "Unauthorized" })
		}

		// Process the webhook event
		await logActivity({
			userId: null,
			action: "webhook_event_received",
			description: `Webhook event received: ${event.type}`,
			req,
			event,
		})

		console.log("====================================")
		console.log(event)
		console.log("====================================")

		res.status(200).json({ msg: "Webhook processed successfully" })
	} catch (error) {
		await logActivity({
			userId: null,
			action: "webhook_error",
			description: `Unexpected server error during webhook processing: ${error.message}`,
			req,
		})

		res.status(500).json({ msg: "Server error", err: err.message })
	}
}

module.exports = {
	handleWebhookRequest,
}
