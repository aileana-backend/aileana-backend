const { prismadb } = require("../../config/prisma.config")
const { WalletStatus, TransactionType, TransactionFlow, TransactionStatus } = require("../../generated/prisma")
const User = require("../../models/User")
const { contractCode } = require("../../monnify/endpoints.const")
const monnifyService = require("../../monnify/monnify.service")
const logActivity = require("../../utils/activityLogger")
const { encrypt } = require("../../utils/encrypter")
const { Types } = require("mongoose")
const ledgerService = require("./ledger.service")
const transactionService = require("./transaction.service")

/**
 * Wallet Service
 * Handles wallet operations: balance, credit, debit, transfer, and more.
 * @module walletService
 */
class WalletService {
	/**
	 * Find a user's active wallet
	 * @param {string} userId
	 * @returns {Promise<object|false>}
	 */
	async findOne(userId) {
		try {
			const wallet = await prismadb.wallet.findFirst({ where: { userId, status: WalletStatus.Active, isDeleted: false } })
			if (!wallet) throw new Error("Wallet not found")
			return wallet
		} catch (error) {
			console.error("Error finding wallet:", error)
			return false
		}
	}

	/**
	 * Get wallet balance for a user
	 * @param {string} userId
	 * @returns {Promise<number>}
	 */
	async getBalance(userId) {
		try {
			if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid user ID")
			const wallet = await this.findOne(userId)
			if (!wallet) throw new Error("Wallet not found")
			return wallet.balance
		} catch (err) {
			console.error(`[WalletService][getBalance]`, err)
			return false
		}
	}

	/**
	 * Credit wallet
	 * @param {string} userId
	 * @param {number} amount
	 * @param {object} [meta]
	 * @returns {Promise<object>}
	 */
	async creditWallet(userId, amount, reference, desc = "Transaction successful", meta = {}) {
		try {
			if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid user ID")
			if (amount <= 0) throw new Error("Invalid credit amount")

			return prismadb.$transaction(async (tx) => {
				const wallet = await tx.$queryRaw`SELECT * FROM "Wallet" WHERE "userId" = ${userId} AND "isDeleted" = false FOR UPDATE`

				if (!wallet) throw new Error("Wallet not found")

				// create transaction record
				const transaction = await transactionService.createTransaction({
					userId,
					walletId: wallet.id,
					amount,
					type: TransactionType.Deposit,
					flow: TransactionFlow.Credit,
					reference,
					status: TransactionStatus.Pending,
					description: desc,
					metadata: meta,
				})
				if (!transaction) throw new Error("Could not create transaction")

				// validate ledger entry
				const ledgerValidation = await ledgerService.validateLedgerInflowOutflowConsistency({ walletId: wallet.id })
				if (!ledgerValidation.valid) throw new Error("Ledger inconsistency detected")

				// Update wallet balance
				const updatedWallet = await tx.wallet.update({
					where: { id: wallet.id },
					data: { balance: wallet.balance + amount },
				})
				if (!updatedWallet) throw new Error("Could not update wallet")

				// Log ledger entry
				const logEntry = await ledgerService.logLedgerCreditEntry({
					walletId: wallet.id,
					transactionId: transaction.id,
					credit: amount,
				})
				if (!logEntry) throw new Error("Could not log ledger entry")

				// Validate ledger entry again
				const postLedgerValidation = await ledgerService.validateLedgerInflowOutflowConsistency({ walletId: wallet.id })
				if (!postLedgerValidation.valid) {
					const failedTransaction = await transactionService.updateTransactionStatus(transaction.id, TransactionStatus.Failed)
					if (!failedTransaction) console.error("Could not update failed transaction status after ledger inconsistency")
					throw new Error("Ledger inconsistency detected after credit")
				}

				// Update transaction status to completed
				const completedTransaction = await transactionService.updateTransactionStatus(transaction.id, TransactionStatus.Successful)
				if (!completedTransaction) throw new Error("Could not update transaction status")

				return updatedWallet
			})
		} catch (err) {
			console.error(`[WalletService][creditWallet]`, err)
			return false
		}
	}

	/**
	 * Debit wallet
	 * @param {string} userId
	 * @param {number} amount
	 * @param {object} [meta]
	 * @returns {Promise<object>}
	 */
	async debitWallet(userId, amount, meta = {}) {
		try {
		} catch (err) {
			console.error(`[WalletService][debitWallet]`, err)
			return false
		}
	}

	/**
	 * Transfer funds between wallets
	 * @param {string} fromUserId
	 * @param {string} toUserId
	 * @param {number} amount
	 * @param {object} [meta]
	 * @returns {Promise<object>}
	 */
	async transferFunds(fromUserId, toUserId, amount, meta = {}) {
		// Note: Transaction/session logic may need to be adapted for your ORM
		try {
		} catch (err) {
			console.error(`[WalletService][transferFunds]`, err)
			return false
		}
	}

	/**
	 * Securely get wallet details (with encryption)
	 * @param {string} userId
	 * @returns {Promise<object>}
	 */
	async getEncryptedWallet(userId) {
		try {
			if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid user ID")
			const wallet = await this.findOne(userId)
			if (!wallet) throw new Error("Wallet not found")
			return encrypt({ balance: wallet.balance, id: wallet.id })
		} catch (err) {
			console.error(`[WalletService][getEncryptedWallet]`, err)
			return false
		}
	}

	/**
	 * Freeze wallet (block all transactions)
	 * @param {string} userId
	 * @returns {Promise<object>}
	 */
	async freezeWallet(userId) {
		// TODO: Implement wallet freezing logic
		throw new Error("Not implemented")
	}

	/**
	 * Unfreeze wallet (allow transactions)
	 * @param {string} userId
	 * @returns {Promise<object>}
	 */
	async unfreezeWallet(userId) {
		// TODO: Implement wallet unfreezing logic
		throw new Error("Not implemented")
	}

	/**
	 * Set spending limit for a wallet
	 * @param {string} userId
	 * @param {number} limit
	 * @returns {Promise<object>}
	 */
	async setSpendingLimit(userId, limit) {
		// TODO: Implement spending limit logic
		throw new Error("Not implemented")
	}

	/**
	 * Create a wallet for a user
	 * @param {string} userId
	 * @param {string} currency
	 * @returns {Promise<object|false>}
	 */
	async createWallet(userId = "", currency = "NGN") {
		try {
			const user = await User.findById(userId)
			if (!user) throw new Error("User not found")

			const walletExists = await this.findOne(user.id)
			if (walletExists) {
				return walletExists
			}

			// format the user data
			const walletPayload = {
				accountName: `${user.first_name} ${user.last_name}`,
				customerName: `${user.first_name} ${user.last_name}`,
				customerEmail: user.email,
				currencyCode: currency,
				contractCode: contractCode,
				accountReference: `AILEANA_${user.id}`,
				getAllAvailableBanks: true,
				bvn: user?.bvn || "21212121212",
				currency,
			}

			const response = await monnifyService.createVirtualAccount(walletPayload)
			if (!response.requestSuccessful) {
				throw new Error("Could not create wallet")
			}

			const { accounts } = response.responseBody
			if (!Array.isArray(accounts) || accounts.length === 0) {
				throw new Error("Could not create wallet")
			}

			const walletData = accounts[0]
			const wallet = await prismadb.wallet.create({
				data: {
					userId: user.id,
					walletAddress: walletData.accountNumber,
					walletAddressName: walletData.bankName,
					walletAddressId: walletData.bankCode,
					walletAddressTag: walletData.accountName,
					status: WalletStatus.Active,
					balance: "0.0",
				},
			})
			if (!wallet) throw new Error("Could not create wallet")

			await logActivity({
				userId: user.id,
				action: "create_wallet",
				description: "User wallet was generated.",
			})

			return wallet
		} catch (error) {
			console.error("Error creating wallet:", error)
			return false
		}
	}

	/**
	 * Get the wallet for a user (any status)
	 * @param {string} userId
	 * @returns {Promise<object|false>}
	 */
	async getWallet(userId) {
		try {
			return await prismadb.wallet.findFirst({ where: { userId, isDeleted: false } })
		} catch (error) {
			console.error("Error getting wallet:", error)
			return false
		}
	}
}

module.exports = new WalletService()
