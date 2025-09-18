const mongoose = require("mongoose")

const walletSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			unique: true,
		},
		nairaBalance: { type: Number, default: 0 },
		credixBalance: { type: Number, default: 0 },
		tradebitBalance: { type: Number, default: 0 },
	},
	{ timestamps: true },
)

module.exports = mongoose.model("Wallet", walletSchema)
