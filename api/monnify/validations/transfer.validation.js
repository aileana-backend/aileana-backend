const { z } = require("zod")

const transferValidationSchema = z.object({
	amount: z.number().positive(),
	reference: z.string().min(1),
	narration: z.string().min(1),
	destinationBankCode: z.string().length(3),
	destinationAccountNumber: z.string().length(10),
	currency: z.string().length(3),
	sourceAccountNumber: z.string().length(10),
})

module.exports = transferValidationSchema
