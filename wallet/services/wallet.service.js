const prismadb = require("../../config/prisma.config")
const { WalletStatus } = require("../../generated/prisma")
const User = require("../../models/User")
const { contractCode } = require("../../monnify/endpoints.const")
const monnifyService = require("../../monnify/monnify.service")
const logActivity = require("../../utils/activityLogger")
const Transaction = require("../../models/Transaction")
const { encrypt } = require("../../utils/encrypter")
const { logTransaction } = require("../../utils/transactionLogger")
const { Types } = require("mongoose")

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
			throw err
		}
	}

	/**
	 * Credit wallet
	 * @param {string} userId
	 * @param {number} amount
	 * @param {object} [meta]
	 * @returns {Promise<object>}
	 */
	async creditWallet(userId, amount, meta = {}) {
		try {
			if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid user ID")
			if (typeof amount !== "number" || amount <= 0) throw new Error("Invalid amount")
			const wallet = await this.findOne(userId)
			if (!wallet) throw new Error("Wallet not found")
			// Update balance
			const updated = await prismadb.wallet.update({ where: { userId }, data: { balance: wallet.balance + amount } })
			const txn = await Transaction.create({
				user: userId,
				type: "credit",
				amount,
				meta,
				status: "success",
			})
			await logTransaction(txn)
			return { balance: updated.balance, transaction: txn }
		} catch (err) {
			console.error(`[WalletService][creditWallet]`, err)
			throw err
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
			if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid user ID")
			if (typeof amount !== "number" || amount <= 0) throw new Error("Invalid amount")
			const wallet = await this.findOne(userId)
			if (!wallet) throw new Error("Wallet not found")
			if (wallet.balance < amount) throw new Error("Insufficient balance")
			// Update balance
			const updated = await prismadb.wallet.update({ where: { userId }, data: { balance: wallet.balance - amount } })
			const txn = await Transaction.create({
				user: userId,
				type: "debit",
				amount,
				meta,
				status: "success",
			})
			await logTransaction(txn)
			return { balance: updated.balance, transaction: txn }
		} catch (err) {
			console.error(`[WalletService][debitWallet]`, err)
			throw err
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
			if (!Types.ObjectId.isValid(fromUserId) || !Types.ObjectId.isValid(toUserId)) throw new Error("Invalid user ID")
			if (fromUserId === toUserId) throw new Error("Cannot transfer to self")
			if (typeof amount !== "number" || amount <= 0) throw new Error("Invalid amount")
			const fromWallet = await this.findOne(fromUserId)
			const toWallet = await this.findOne(toUserId)
			if (!fromWallet || !toWallet) throw new Error("Wallet not found")
			if (fromWallet.balance < amount) throw new Error("Insufficient balance")
			// Update balances
			await prismadb.wallet.update({ where: { userId: fromUserId }, data: { balance: fromWallet.balance - amount } })
			await prismadb.wallet.update({ where: { userId: toUserId }, data: { balance: toWallet.balance + amount } })
			const txn = await Transaction.create([
				{
					user: fromUserId,
					type: "transfer-out",
					amount,
					meta,
					status: "success",
				},
				{
					user: toUserId,
					type: "transfer-in",
					amount,
					meta,
					status: "success",
				},
			])
			await logTransaction(txn[0])
			await logTransaction(txn[1])
			return { from: fromWallet.balance - amount, to: toWallet.balance + amount, transactions: txn }
		} catch (err) {
			console.error(`[WalletService][transferFunds]`, err)
			throw err
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
			throw err
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
