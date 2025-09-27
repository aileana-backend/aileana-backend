const { Types } = require("mongoose")
const { TransactionFlow, TransactionStatus, TransactionType } = require("../../generated/prisma")
const { prismaConn, prismadb } = require("../../config/prisma.config")

class TransactionService {
	/**
	 * Create a new transaction record
	 * @returns
	 */
	async createTransaction(tranx, { userId, walletId, fees = 0, amount = 0, type, flow, status = "pending", reference, description = null, relatedTransactionId = null, metadata = null }) {
		try {
			if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid user ID")

			if (!walletId) throw new Error("Invalid wallet ID")

			const validFlow = Object.values(TransactionFlow).includes(flow)
			if (!validFlow) throw new Error("Invalid transaction flow")

			const validType = Object.values(TransactionType).includes(type)
			if (!validType) throw new Error("Invalid transaction type")

			let totalAmount = flow === TransactionFlow.Credit ? parseFloat(amount) - parseFloat(fees) : parseFloat(amount) + parseFloat(fees)

			if (totalAmount <= 0) throw new Error("Total transaction amount must be greater than zero")

			if (!reference) throw new Error("Transaction reference is required")

			const validStatus = Object.values(TransactionStatus).includes(status)
			if (!validStatus) throw new Error("Invalid transaction status")

			// validate if the reference already exists
			const existingTransaction = await tranx.transaction.findFirst({ where: { reference, isDeleted: false } })
			if (existingTransaction) throw new Error("A transaction with this reference already exist.")

			return await tranx.transaction.create({
				data: {
					userId,
					walletId,
					fees,
					amount,
					totalAmount,
					type,
					flow,
					status,
					reference,
					description,
					relatedTransactionId,
					metadata,
				},
			})
		} catch (error) {
			console.error(`[TransactionService][createTransaction]`, error)
			return false
		}
	}

	/**
	 * Get a transaction by its reference ID
	 * @param {string} reference The transaction reference ID
	 * @returns {Promise<Object|null|false>}
	 */
	async getTransactionByReference(reference) {
		try {
			if (!reference) throw new Error("Transaction reference is required")

			return await prismadb.transaction.findFirst({ where: { reference, isDeleted: false } })
		} catch (error) {
			console.error(`[TransactionService][getTransactionByReference]`, error)
			return false
		}
	}

	/**
	 * Find a transaction by its ID
	 * @param {string} transactionId The transaction ID
	 * @returns {Promise<Object|null|false>}
	 */
	async findOne(transactionId) {
		try {
			if (!transactionId) throw new Error("Transaction ID is required")

			return await prismadb.transaction.findFirst({ where: { id: transactionId, isDeleted: false } })
		} catch (error) {
			console.error(`[TransactionService][findOne]`, error)
			return false
		}
	}

	/**
	 * Update the status of a transaction
	 * @param {string} transactionId
	 * @param {string} status
	 * @returns {Promise<Object|null|false>}
	 */
	async updateTransactionStatus(tranx, { transactionId, status }) {
		try {
			if (!transactionId) throw new Error("Transaction ID is required")

			const validStatus = Object.values(TransactionStatus).includes(status)
			if (!validStatus) throw new Error("Invalid transaction status")

			return await tranx.transaction.update({
				where: { id: transactionId },
				data: { status },
			})
		} catch (error) {
			console.error(`[TransactionService][updateTransactionStatus]`, error)
			return false
		}
	}
}

module.exports = new TransactionService()
