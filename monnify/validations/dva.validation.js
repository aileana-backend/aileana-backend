const { z } = require("zod")

const incomeSplitConfigSchema = z.object({
	subAccountCode: z.string(),
	feePercentage: z.number(),
	splitAmount: z.number(),
	feeBearer: z.boolean(),
})

const metaDataSchema = z.object({
	ipAddress: z.string().optional(), // ensure valid IP if provided
	deviceType: z.string().optional(),
})

const dvaValidationSchema = z
	.object({
		accountReference: z.string(),
		accountName: z.string(),
		currencyCode: z.string(),
		contractCode: z.string(),
		customerEmail: z.string().email(),
		customerName: z.string(),
		bvn: z.string().optional(),
		nin: z.string().optional(),
		getAllAvailableBanks: z.boolean(),
		incomeSplitConfig: z.array(incomeSplitConfigSchema).optional(),
		metaData: metaDataSchema.optional(),
	})
	.refine((data) => data.bvn || data.nin, {
		message: "Either 'bvn' or 'nin' must be provided",
		path: ["bvn"], // you can point to bvn or nin
	})

module.exports = dvaValidationSchema
