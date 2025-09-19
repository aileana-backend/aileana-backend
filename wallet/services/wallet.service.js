const prismadb = require("../../config/prisma.config")
const { WalletStatus } = require("../../generated/prisma")
const User = require("../../models/User")
const { contractCode } = require("../../monnify/endpoints.const")
const monnifyService = require("../../monnify/monnify.service")

class WalletService {
	async findOne(userId) {
		try {
			return await prismadb.wallet.findFirst({ where: { userId, status: WalletStatus.Active, isDeleted: false } })
		} catch (error) {
			console.error("Error finding wallet:", error)
			return false
		}
	}

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
			if (!Array.isArray(accounts) && accounts.length === 0) {
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

			return wallet
		} catch (error) {
			console.error("Error creating wallet:", error)
			return false
		}
	}

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
