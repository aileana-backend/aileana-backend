// utils/webhookVerifier.js
const crypto = require("crypto")

const DEFAULT_MERCHANT_CLIENT_SECRET = process.env.MONNIFY_SECRET_KEY || ""

/**
 * Compute HMAC-SHA512 hash of the request body using the merchant secret
 * @param {string} requestBody - The raw request body (must be a string, not parsed JSON)
 * @param {string} [secret=DEFAULT_MERCHANT_CLIENT_SECRET] - Optional secret override
 * @returns {string} - The hex encoded HMAC hash
 */
function computeHash(requestBody, secret = DEFAULT_MERCHANT_CLIENT_SECRET) {
	return crypto.createHmac("sha512", secret).update(requestBody, "utf8").digest("hex")
}

/**
 * Verify webhook payload against the signature header
 * @param {string} requestBody - Raw request body (unparsed JSON string)
 * @param {string} signatureHeader - Signature received from webhook headers
 * @param {string} [secret=DEFAULT_MERCHANT_CLIENT_SECRET]
 * @returns {boolean} - True if signature is valid
 */
function verifyWebhook(requestBody, signatureHeader, secret = DEFAULT_MERCHANT_CLIENT_SECRET) {
	const computed = computeHash(requestBody, secret)
	return computed.toLowerCase() === (signatureHeader || "").toLowerCase()
}

module.exports = {
	computeHash,
	verifyWebhook,
}
