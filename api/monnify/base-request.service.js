const axios = require("axios")

class BaseRequestService {
	constructor(baseURL, apiKey) {
		this.client = axios.create({
			baseURL: baseURL,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
		})
	}

	async get(endpoint, params = {}) {
		try {
			const response = await this.client.get(endpoint, { params })
			return response.data
		} catch (error) {
			this.handleError(error)
		}
	}

	async post(endpoint, data = {}) {
		try {
			const response = await this.client.post(endpoint, data)
			return response.data
		} catch (error) {
			this.handleError(error)
		}
	}

	async put(endpoint, data = {}) {
		try {
			const response = await this.client.put(endpoint, data)
			return response.data
		} catch (error) {
			this.handleError(error)
		}
	}

	async patch(endpoint, data = {}) {
		try {
			const response = await this.client.patch(endpoint, data)
			return response.data
		} catch (error) {
			this.handleError(error)
		}
	}

	async delete(endpoint) {
		try {
			const response = await this.client.delete(endpoint)
			return response.data
		} catch (error) {
			this.handleError(error)
		}
	}

	handleError(error) {
		if (error.response) {
			// Server responded with a status other than 2xx
			console.error("API Error:", error.response.status, error.response.data)
		} else if (error.request) {
			// No response received
			console.error("No response from API:", error.request)
		} else {
			// Other errors
			console.error("Error:", error.message)
		}
	}
}

module.exports = BaseRequestService
