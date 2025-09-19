const ENDPOINTS = require("./endpoints.const")
const HttpClientService = require("./http-client.service")
const dvaValidationSchema = require("./validations/dva.validation")
const transferValidationSchema = require("./validations/transfer.validation")

class MonnifyService extends HttpClientService {
	constructor() {
		super()
	}

	async createVirtualAccount(params) {
		try {
			// Validate params using Zod schema
			const parsedParams = dvaValidationSchema.parse(params)
			const response = await this.client.post(ENDPOINTS.DVA.CreateDVA, parsedParams)
			return response.data
		} catch (error) {
			if (error.response) {
				const { status, data } = error.response
				if (data?.responseCode === "99") {
					// Account already exists, fetch the existing account
					return this.getVirtualAccount(params.accountReference)
				}
			}
			this.handleError(error)

			return false
		}
	}

	async getVirtualAccount(accountReference) {
		try {
			const response = await this.client.get(ENDPOINTS.DVA.GetDVA(accountReference))
			return response.data
		} catch (error) {
			this.handleError(error)

			return false
		}
	}

	async transferFunds(params) {
		try {
			// Validate params using Zod schema
			const parsedParams = transferValidationSchema.parse(params)
			const response = await this.client.post(ENDPOINTS.TRANSFER.InitiateTransfer, parsedParams)
			return response.data
		} catch (error) {
			this.handleError(error)

			return false
		}
	}
}

module.exports = new MonnifyService()
