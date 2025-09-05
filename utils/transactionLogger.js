const Transaction = require("../models/Transaction");

async function logTransaction(data) {
  const tx = new Transaction({
    ...data,
    reference:
      data.reference || `TX-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
  });
  await tx.save();
  return tx;
}

module.exports = logTransaction;
