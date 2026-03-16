// src/modules/tradebits/tradebits.service.js
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const QRCode = require("qrcode");
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
    const formatDate = (d) =>
      new Intl.DateTimeFormat("en-NG", {
        hour: "numeric",
        minute: "2-digit",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(d));

    // Check send transactions first
    const sendTx = await knex("tradebits_transactions")
      .where({ reference, sender_id: userId })
      .first();

    if (sendTx) {
      return {
        type: "SEND",
        amount: sendTx.amount,
        fee: `₦${parseFloat(sendTx.naira_fee).toFixed(2)}`,
        paymentMethod: sendTx.payment_method,
        giftingStatus: sendTx.gifting_status || "None",
        transactionId: sendTx.id,
        date: formatDate(sendTx.created_at),
      };
    }

    // Fall back to buy transactions
    const buyTx = await knex("tradebit_purchases")
      .where({ reference, user_id: userId })
      .first();

    if (!buyTx) throw new Error("Transaction not found");

    return {
      type: "BUY",
      amount: buyTx.tradebits_received,
      nairaAmount: buyTx.naira_amount,
      paymentMethod: buyTx.payment_method,
      status: buyTx.status,
      transactionId: buyTx.id,
      date: formatDate(buyTx.created_at),
    };
  }

  // ─── RECEIVE DETAILS ─────────────────────────────────────

  async getReceiveDetails(userId) {
    const wallet = await knex("tradebits_wallets")
      .where("user_id", userId)
      .select("wallet_address", "balance")
      .first();

    if (!wallet?.wallet_address) {
      throw new Error("Tradebits wallet not found. Buy some Tradebits first.");
    }

    const qrCode = await QRCode.toDataURL(wallet.wallet_address, {
      width: 300,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });

    return {
      wallet_address: wallet.wallet_address,
      balance: wallet.balance,
      qr_code: qrCode,
    };
  }

  // ─── TRANSACTION HISTORY ─────────────────────────────────

  async getHistory(userId) {
    const formatDate = (d) =>
      new Intl.DateTimeFormat("en-NG", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(d));

    // Buy transactions
    const buys = await knex("tradebit_purchases")
      .where("user_id", userId)
      .select("*")
      .orderBy("created_at", "desc");

    // Send/receive transactions (sender or recipient)
    const sends = await knex("tradebits_transactions")
      .where("sender_id", userId)
      .orWhere("recipient_user_id", userId)
      .select("*")
      .orderBy("created_at", "desc");

    const buyItems = buys.map((tx) => ({
      id: tx.id,
      reference: tx.reference,
      title: "Buy Tradebits",
      amount: `+${tx.tradebits_received} coins`,
      isCredit: true,
      date: formatDate(tx.created_at),
      created_at: tx.created_at,
    }));

    const sendItems = sends.map((tx) => {
      const isCredit = tx.recipient_user_id === userId;
      return {
        id: tx.id,
        reference: tx.reference,
        title: "Transferred Tradebits",
        amount: `${isCredit ? "+" : "-"}${tx.amount} coins`,
        isCredit,
        date: formatDate(tx.created_at),
        created_at: tx.created_at,
      };
    });

    // Merge and sort by date descending
    const all = [...buyItems, ...sendItems].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    // Group by date label (Today, Dec 31st 2025, etc.)
    const groups = {};
    const today = new Date().toDateString();

    all.forEach((tx) => {
      const txDate = new Date(tx.created_at);
      const label =
        txDate.toDateString() === today
          ? "Today"
          : new Intl.DateTimeFormat("en-NG", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(txDate);

      if (!groups[label]) groups[label] = [];
      groups[label].push(tx);
    });

    return Object.entries(groups).map(([label, transactions]) => ({
      label,
      transactions,
    }));
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
