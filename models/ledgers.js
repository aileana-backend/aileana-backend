const { Model } = require("objection");

class Ledger extends Model {
  static get tableName() {
    return "ledgers";
  }

  static get jsonSchema() {
    return {
      type: "object",
      required: ["wallet_id", "transaction_id", "amount", "entry_type"],
      properties: {
        id: { type: "string", format: "uuid" },
        wallet_id: { type: "string", format: "uuid" }, // Which specific wallet layer
        transaction_id: { type: "string", format: "uuid" }, // Link to header
        amount: { type: "number" }, // Always positive
        entry_type: { type: "string", enum: ["DEBIT", "CREDIT"] },
        balance_after: { type: "number" }, // Snapshot for auditing
      },
    };
  }
}

module.exports = Ledger;
