const { prismadb } = require("../../config/prisma.config")
const { TransactionFlow } = require("../../generated/prisma")

class LedgerService {
	/**
	 * Logs a ledger credit entry for a wallet transaction.
	 * @returns
	 */
	async logLedgerCreditEntry({ walletId, transactionId, credit = 0, prevBalance = 0, currBalance = 0 }) {
		try {
			if (!walletId) throw new Error("Invalid wallet ID")
			if (!transactionId) throw new Error("Invalid transaction ID")
			if (credit < 0) throw new Error("Invalid credit amount")

			return await this.logLedgerEntry({ walletId, transactionId, amount: credit, prevBalance, currBalance, type: TransactionFlow.Credit })
		} catch (error) {
			console.error(`[LedgerService][logLedgerCreditEntry]`, error)
			return false
		}
	}

	/**
	 * Logs a ledger debit entry for a wallet transaction.
	 * @returns
	 */
	async logLedgerDebitEntry({ walletId, transactionId, debit = 0, prevBalance = 0, currBalance = 0 }) {
		try {
			if (!walletId) throw new Error("Invalid wallet ID")
			if (!transactionId) throw new Error("Invalid transaction ID")
			if (debit < 0) throw new Error("Invalid debit amount")

			return await this.logLedgerEntry({ walletId, transactionId, amount: debit, prevBalance, currBalance, type: TransactionFlow.Debit })
		} catch (error) {
			console.error(`[LedgerService][logLedgerDebitEntry]`, error)
			return false
		}
	}

	/**
	 * Logs a ledger entry for a wallet transaction.
	 * @returns
	 */
	async logLedgerEntry({ walletId, transactionId, amount = 0, prevBalance = 0, currBalance = 0, type = TransactionFlow.Credit }) {
		if (!walletId) throw new Error("Invalid wallet ID")
		if (!transactionId) throw new Error("Invalid transaction ID")
		if (amount <= 0) throw new Error("Invalid amount")
		// Validate entry type
		if (!Object.values(TransactionFlow).includes(type)) throw new Error("Invalid entry type")

		// Check if ledger entry already exists for this transaction and wallet
		const existingEntry = await prismadb.ledger.findFirst({
			where: { walletId, transactionId, isDeleted: false },
		})
		if (existingEntry) return existingEntry

		// Create ledger entry
		const ledgerEntry = await prismadb.ledger.create({
			data: {
				walletId,
				transactionId,
				prevBalance,
				currBalance,
				credit: type === TransactionFlow.Credit ? amount : 0,
				debit: type === TransactionFlow.Debit ? amount : 0,
			},
		})
		return ledgerEntry
	}

	/**
	 * The goal of this function is to validate the user incoming and outgoing transactions against their ledger entries
	 * to ensure that the sum of all credits minus the sum of all debits equals the current balance in the wallet.
	 * This helps to identify any discrepancies or inconsistencies in the ledger records and ensure data integrity and predictability.
	 *
	 * If the validation fails, it means there is a discrepancy between the ledger entries and the wallet balance.
	 * valid: false indicates that the ledger entries do not accurately reflect the wallet's balance.
	 * valid: true indicates that the ledger entries are consistent with the wallet's balance.
	 *
	 * When a discrepancy is detected, the valid action to take is revert wallet operations to the last known good state and flag the account for review.
	 *
	 * It is advisable to run this function before and after any wallet transaction to ensure consistency.
	 */
	async validateLedgerInflowOutflowConsistency({ walletId }) {
		try {
			if (!walletId) throw new Error("Invalid wallet ID")

			// Get user wallet
			const wallet = await prismadb.wallet.findUnique({ where: { id: walletId } })
			if (!wallet) throw new Error("Wallet not found")

			// Calculate total credits and debits from ledger entries
			const ledgerEntries = await prismadb.ledger.findMany({
				where: { walletId, isDeleted: false },
				select: { credit: true, debit: true },
			})

			const totalCredits = ledgerEntries.reduce((sum, entry) => sum + entry.credit, 0)
			const totalDebits = ledgerEntries.reduce((sum, entry) => sum + entry.debit, 0)

			// Calculate expected balance
			const expectedBalance = totalCredits - totalDebits

			// Compare expected balance with actual wallet balance
			if (expectedBalance !== wallet.balance) {
				console.error(`Ledger inconsistency detected for wallet ${walletId}: expected balance ${expectedBalance}, actual balance ${wallet.balance}`)
				return { valid: false, expectedBalance, actualBalance: wallet.balance }
			}

			return { valid: true, expectedBalance, actualBalance: wallet.balance }
		} catch (error) {
			console.error(`[LedgerService][validateLedgerInflowOutflowConsistency]`, error)
			return false
		}
	}

	/**
	 * Get ledger entries for a specific wallet
	 */
	async getLedgerEntries({ walletId, limit = 10, page = 1 }) {
		try {
			if (!walletId) throw new Error("Invalid wallet ID")
			if (limit <= 0 || page <= 0) throw new Error("Invalid pagination parameters")

			const skip = (page - 1) * limit

			const entries = await prismadb.ledger.findMany({
				where: { walletId, isDeleted: false },
				skip,
				take: limit,
				orderBy: { createdAt: "desc" },
			})
			return entries
		} catch (error) {
			console.error(`[LedgerService][getLedgerEntries]`, error)
			return false
		}
	}
}

module.exports = new LedgerService()
