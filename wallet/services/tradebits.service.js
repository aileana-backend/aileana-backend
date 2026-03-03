// src/modules/tradebits/tradebits.service.js
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const knex = require("../../config/pg"); // your knex instance

const RATE = parseFloat(process.env.TRADEBIT_NAIRA_RATE) || 5;

const FEE_MAP = {
  card: 100,
  bank_transfer: 50,
  wallet_balance: 0,
};

class TradebitService {
  // ─── BUY FLOW ───────────────────────────────────────────

  async calculateTradebits(amount) {
    if (!amount || isNaN(amount)) throw new Error("Invalid amount");

    return {
      nairaAmount: parseFloat(amount),
      tradebitsAmount: parseFloat(amount) / RATE,
      rate: RATE,
    };
  }

  async initiatePurchase(userId, nairaAmount, paymentMethod) {
    if (!FEE_MAP.hasOwnProperty(paymentMethod)) {
      throw new Error("Invalid payment method");
    }

    const fee = FEE_MAP[paymentMethod];
    const totalCharge = nairaAmount + fee;
    const tradebitsToReceive = nairaAmount / RATE;

    if (paymentMethod === "wallet_balance") {
      const wallet = await knex("wallets").where("user_id", userId).first();
      if (!wallet || wallet.balance < totalCharge) {
        throw new Error("Insufficient wallet balance");
      }
    }

    return { nairaAmount, fee, totalCharge, tradebitsToReceive, paymentMethod };
  }

  async confirmPurchase(userId, nairaAmount, paymentMethod, pin) {
    // 1. Verify PIN
    await this._verifyPin(userId, pin);

    const tradebitsToReceive = nairaAmount / RATE;
    const reference = this._generateReference("BUY-TB");

    return await knex.transaction(async (trx) => {
      // 2. Handle payment
      if (paymentMethod === "wallet_balance") {
        const wallet = await trx("wallets")
          .where("user_id", userId)
          .forUpdate()
          .first();
        if (!wallet || wallet.balance < nairaAmount)
          throw new Error("Insufficient wallet balance");
        await trx("wallets")
          .where("user_id", userId)
          .decrement("balance", nairaAmount);
      }
      // card / bank_transfer: Monnify already charged before this call

      // 3. Credit Tradebits wallet
      await this._creditTradebitWallet(trx, userId, tradebitsToReceive);

      // 4. Record purchase
      const [purchase] = await trx("tradebit_purchases")
        .insert({
          user_id: userId,
          naira_amount: nairaAmount,
          tradebits_received: tradebitsToReceive,
          payment_method: paymentMethod,
          status: "completed",
          reference,
        })
        .returning("*");

      return {
        tradebitsReceived: purchase.tradebits_received,
        reference: purchase.reference,
        message: "Your purchase was successful!",
      };
    });
  }

  // ─── SEND FLOW ───────────────────────────────────────────

  async previewFee(amount) {
    if (!amount || isNaN(amount)) throw new Error("Invalid amount");

    const nairaValue = parseFloat(amount) * RATE;
    const nairaFee = nairaValue * 0.01; // 1% fee

    return {
      amount: parseFloat(amount),
      nairaFee,
      message: `You will be charged ₦${nairaFee.toFixed(2)} for this transaction.`,
    };
  }

  async verifyAddress(address) {
    const wallet = await knex("tradebits_wallets")
      .join("users", "users.id", "tradebits_wallets.user_id")
      .where("tradebits_wallets.wallet_address", address)
      .select("users.display_name", "tradebits_wallets.wallet_address")
      .first();

    if (!wallet) throw new Error("Address not found");

    return {
      verified: true,
      recipientName: wallet.display_name,
      address: wallet.wallet_address,
    };
  }

  async confirmSend(userId, recipientAddress, amount, isAnonymous, pin) {
    // 1. Verify PIN
    await this._verifyPin(userId, pin);

    const FEE_PERCENT = 0.01;
    const tradebitFee = amount * FEE_PERCENT;
    const nairaFee = amount * RATE * FEE_PERCENT;
    const totalDeduction = amount + tradebitFee;
    const reference = this._generateReference("TB");

    return await knex.transaction(async (trx) => {
      // 2. Check sender balance
      const senderWallet = await trx("tradebits_wallets")
        .where("user_id", userId)
        .forUpdate()
        .first();

      if (!senderWallet || senderWallet.balance < totalDeduction) {
        throw new Error("Insufficient Tradebits balance");
      }

      // 3. Find recipient
      const recipientWallet = await trx("tradebits_wallets")
        .where("wallet_address", recipientAddress)
        .first();

      if (!recipientWallet) throw new Error("Recipient address not found");

      // 4. Deduct sender
      await trx("tradebits_wallets")
        .where("user_id", userId)
        .decrement("balance", totalDeduction);

      // 5. Credit recipient
      await trx("tradebits_wallets")
        .where("wallet_address", recipientAddress)
        .increment("balance", amount);

      // 6. Record transaction
      const [transaction] = await trx("tradebits_transactions")
        .insert({
          sender_id: userId,
          recipient_address: recipientAddress,
          recipient_user_id: recipientWallet.user_id,
          amount,
          fee: tradebitFee,
          naira_fee: nairaFee,
          is_anonymous: isAnonymous || false,
          gifting_status: isAnonymous ? "Anonymous" : null,
          payment_method: "Wallet Balance",
          status: "completed",
          reference,
        })
        .returning("*");

      return {
        amount: transaction.amount,
        reference: transaction.reference,
        message: "Transfer was successful!",
      };
    });
  }

  // ─── SHARED ──────────────────────────────────────────────

  async getBalance(userId) {
    const wallet = await knex("tradebits_wallets")
      .where("user_id", userId)
      .select("balance", "wallet_address")
      .first();

    return {
      balance: wallet?.balance || 0,
      address: wallet?.wallet_address || null,
    };
  }

  async getTransaction(userId, reference) {
    const tx = await knex("tradebits_transactions")
      .where("reference", reference)
      .where("sender_id", userId)
      .first();

    if (!tx) throw new Error("Transaction not found");

    return {
      amount: tx.amount,
      fee: `₦${parseFloat(tx.naira_fee).toFixed(2)}`,
      paymentMethod: tx.payment_method,
      giftingStatus: tx.gifting_status || "None",
      transactionId: tx.id,
      date: new Intl.DateTimeFormat("en-NG", {
        hour: "numeric",
        minute: "2-digit",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(tx.created_at)),
    };
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────

  async _verifyPin(userId, pin) {
    const user = await knex("users").where("id", userId).first();
    if (!user?.transaction_pin) throw new Error("Transaction PIN not set");

    const valid = await bcrypt.compare(String(pin), user.transaction_pin);
    if (!valid) throw new Error("Invalid transaction PIN");
  }

  async _creditTradebitWallet(trx, userId, amount) {
    const wallet = await trx("tradebits_wallets")
      .where("user_id", userId)
      .first();

    if (wallet) {
      await trx("tradebits_wallets")
        .where("user_id", userId)
        .increment("balance", amount);
    } else {
      const address = `0x${crypto.randomBytes(20).toString("hex")}`;
      await trx("tradebits_wallets").insert({
        user_id: userId,
        balance: amount,
        wallet_address: address,
      });
    }
  }

  _generateReference(prefix) {
    return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  }
}

module.exports = new TradebitService();
