const { Model } = require("objection");

class Transaction extends Model {
  static get tableName() {
    return "transactions";
  }

  static get jsonSchema() {
    return {
      type: "object",
      required: ["transaction_type", "reference"],
      properties: {
        id: { type: "string", format: "uuid" },
        transaction_type: { type: "string" }, // e.g., 'CREDIT_EARNING', 'GIFT_SEND', 'FIAT_DEPOSIT'
        reference: { type: "string" }, // Unique external/internal ref
        description: { type: "string" },
        metadata: { type: "object" }, // Store flexible data like "post_id"
        status: {
          type: "string",
          enum: ["pending", "completed", "failed"],
          default: "pending",
        },
      },
    };
  }
}

module.exports = Transaction;
