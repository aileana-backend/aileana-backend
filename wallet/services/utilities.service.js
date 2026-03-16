const bcrypt = require("bcrypt");
const knex = require("../../config/pg");
const { uniqueId } = require("../../utils/string.util");
const flutterwaveService = require("../../api/flutterwave/flutterwave.service");
const transactionService = require("./transaction.service");
const ledgerService = require("./ledger.service");

class UtilitiesService {
  constructor(user) {
    this.user = user;
  }

  // ─── PIN VERIFICATION ──────────────────────────────────────────────────────

  async _verifyPin(pin) {
    const user = await knex("users")
      .where({ id: this.user.id })
      .select("pin")
      .first();

    if (!user?.transaction_pin) {
      return { valid: false, message: "Transaction PIN not set. Please create a PIN first." };
    }

    const isValid = await bcrypt.compare(String(pin), user.pin);
    if (!isValid) {
      return { valid: false, message: "Incorrect transaction PIN." };
    }

    return { valid: true };
  }

  // ─── GET NGN WALLET ────────────────────────────────────────────────────────

  async _getNGNWallet() {
    return knex("wallets")
      .where({
        user_id: this.user.id,
        wallet_type: "FIAT",
        currency_code: "NGN",
        is_deleted: false,
      })
      .first();
  }

  // ─── DEBIT WALLET (with row lock inside a transaction) ─────────────────────

  async _debitWallet(trx, walletId, amount, reference, description) {
    const [wallet] = await trx("wallets")
      .where({ id: walletId })
      .forUpdate()
      .select("balance");

    if (!wallet) throw new Error("Wallet not found");
    if (Number(wallet.balance) < amount) throw new Error("Insufficient balance");

    await trx("wallets")
      .where({ id: walletId })
      .decrement("balance", amount)
      .update({ updated_at: new Date() });

    await ledgerService.recordDebit({
      wallet_id: walletId,
      amount,
      reference,
      description,
      trx,
    });
  }

  // ─── GET BILL CATEGORIES ──────────────────────────────────────────────────

  /**
   * Returns providers/plans for a utility type
   * type: "AIRTIME" | "DATA_BUNDLE" | "DSTV" | "GOTV" | "STARTIMES" | "ELECTRICITY"
   */
  async getBillCategories(type) {
    try {
      const result = await flutterwaveService.getBillCategories({ type });

      return {
        success: true,
        status: 200,
        message: "Bill categories retrieved",
        data: result.data || [],
      };
    } catch (error) {
      console.error("getBillCategories error:", error.message);
      throw error;
    }
  }

  // ─── VALIDATE CUSTOMER ───────────────────────────────────────────────────

  /**
   * Validate meter number (electricity) or smartcard number (cable TV) before payment
   */
  async validateCustomer(item_code, customer) {
    try {
      const result = await flutterwaveService.validateCustomer(item_code, customer);

      return {
        success: true,
        status: 200,
        message: "Customer validated",
        data: result.data,
      };
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      return { success: false, status: 400, message: msg };
    }
  }

  // ─── BUY AIRTIME ─────────────────────────────────────────────────────────

  /**
   * @param {object} payload
   * @param {string} payload.phone        - Recipient phone (e.g. "+2349030304556")
   * @param {number} payload.amount       - Amount in NGN (min 50)
   * @param {string} payload.biller_name  - Network name e.g. "MTN", "AIRTEL", "GLO", "9MOBILE"
   * @param {string} payload.pin          - User transaction PIN
   */
  async buyAirtime({ phone, amount, biller_name, pin }) {
    try {
      const pinCheck = await this._verifyPin(pin);
      if (!pinCheck.valid) {
        return { success: false, status: 400, message: pinCheck.message };
      }

      const wallet = await this._getNGNWallet();
      if (!wallet) return { success: false, status: 404, message: "NGN wallet not found" };
      if (Number(wallet.balance) < amount) {
        return { success: false, status: 400, message: "Insufficient wallet balance" };
      }

      const reference = `AIRTIME-${this.user.id}-${uniqueId()}`;

      const flwResult = await flutterwaveService.createBillPayment({
        type: "AIRTIME",
        customer: phone,
        amount,
        biller_name,
        reference,
      });

      if (flwResult.status !== "success") {
        return { success: false, status: 400, message: flwResult.message || "Airtime purchase failed" };
      }

      // Debit wallet after successful Flutterwave response
      await knex.transaction(async (trx) => {
        await this._debitWallet(trx, wallet.id, amount, reference, `Airtime purchase - ${phone}`);
        await transactionService.create({
          sender_id: this.user.id,
          wallet_id: wallet.id,
          type: "DEBIT",
          category: "AIRTIME",
          amount,
          reference,
          status: "SUCCESS",
          narration: `₦${amount} airtime to ${phone} (${biller_name})`,
          meta: { phone, biller_name, flw_reference: flwResult.data?.flw_ref },
          trx,
        });
      });

      return {
        success: true,
        status: 200,
        message: `₦${amount} airtime sent to ${phone} successfully`,
        data: {
          reference,
          phone,
          amount,
          network: biller_name,
          flw_reference: flwResult.data?.flw_ref,
        },
      };
    } catch (error) {
      console.error("buyAirtime error:", error.message);
      throw error;
    }
  }

  // ─── BUY DATA ────────────────────────────────────────────────────────────

  /**
   * @param {object} payload
   * @param {string} payload.phone        - Recipient phone
   * @param {number} payload.amount       - Plan amount
   * @param {string} payload.biller_name  - Network e.g. "MTN DATA", "AIRTEL DATA"
   * @param {string} payload.item_code    - Data plan item_code from bill categories
   * @param {string} payload.pin          - User transaction PIN
   */
  async buyData({ phone, amount, biller_name, item_code, pin }) {
    try {
      const pinCheck = await this._verifyPin(pin);
      if (!pinCheck.valid) {
        return { success: false, status: 400, message: pinCheck.message };
      }

      const wallet = await this._getNGNWallet();
      if (!wallet) return { success: false, status: 404, message: "NGN wallet not found" };
      if (Number(wallet.balance) < amount) {
        return { success: false, status: 400, message: "Insufficient wallet balance" };
      }

      const reference = `DATA-${this.user.id}-${uniqueId()}`;

      const flwResult = await flutterwaveService.createBillPayment({
        type: "DATA_BUNDLE",
        customer: phone,
        amount,
        biller_name,
        reference,
      });

      if (flwResult.status !== "success") {
        return { success: false, status: 400, message: flwResult.message || "Data purchase failed" };
      }

      await knex.transaction(async (trx) => {
        await this._debitWallet(trx, wallet.id, amount, reference, `Data purchase - ${phone}`);
        await transactionService.create({
          user_id: this.user.id,
          wallet_id: wallet.id,
          type: "DEBIT",
          category: "DATA",
          amount,
          reference,
          status: "SUCCESS",
          narration: `Data bundle to ${phone} (${biller_name})`,
          meta: { phone, biller_name, item_code, flw_reference: flwResult.data?.flw_ref },
          trx,
        });
      });

      return {
        success: true,
        status: 200,
        message: `Data bundle sent to ${phone} successfully`,
        data: {
          reference,
          phone,
          amount,
          network: biller_name,
          flw_reference: flwResult.data?.flw_ref,
        },
      };
    } catch (error) {
      console.error("buyData error:", error.message);
      throw error;
    }
  }

  // ─── PAY CABLE TV ────────────────────────────────────────────────────────

  /**
   * @param {object} payload
   * @param {string} payload.smartcard_number  - Decoder/smartcard number
   * @param {number} payload.amount            - Subscription amount
   * @param {string} payload.biller_name       - "DSTV", "GOTV", "STARTIMES"
   * @param {string} payload.item_code         - Plan item_code from bill categories
   * @param {string} payload.pin               - User transaction PIN
   */
  async payCableTv({ smartcard_number, amount, biller_name, item_code, pin }) {
    try {
      const pinCheck = await this._verifyPin(pin);
      if (!pinCheck.valid) {
        return { success: false, status: 400, message: pinCheck.message };
      }

      const wallet = await this._getNGNWallet();
      if (!wallet) return { success: false, status: 404, message: "NGN wallet not found" };
      if (Number(wallet.balance) < amount) {
        return { success: false, status: 400, message: "Insufficient wallet balance" };
      }

      // Validate smartcard number before charging
      const validation = await flutterwaveService.validateCustomer(item_code, smartcard_number);
      if (validation.status !== "success") {
        return { success: false, status: 400, message: "Invalid smartcard/decoder number" };
      }

      const reference = `CABLE-${this.user.id}-${uniqueId()}`;

      const flwResult = await flutterwaveService.createBillPayment({
        type: biller_name.toUpperCase(), // DSTV | GOTV | STARTIMES
        customer: smartcard_number,
        amount,
        biller_name,
        reference,
      });

      if (flwResult.status !== "success") {
        return { success: false, status: 400, message: flwResult.message || "Cable TV payment failed" };
      }

      await knex.transaction(async (trx) => {
        await this._debitWallet(trx, wallet.id, amount, reference, `${biller_name} subscription`);
        await transactionService.create({
          user_id: this.user.id,
          wallet_id: wallet.id,
          type: "DEBIT",
          category: "CABLE_TV",
          amount,
          reference,
          status: "SUCCESS",
          narration: `${biller_name} subscription - ${smartcard_number}`,
          meta: {
            smartcard_number,
            biller_name,
            item_code,
            customer_name: validation.data?.name,
            flw_reference: flwResult.data?.flw_ref,
          },
          trx,
        });
      });

      return {
        success: true,
        status: 200,
        message: `${biller_name} subscription successful`,
        data: {
          reference,
          smartcard_number,
          customer_name: validation.data?.name,
          amount,
          provider: biller_name,
          flw_reference: flwResult.data?.flw_ref,
        },
      };
    } catch (error) {
      console.error("payCableTv error:", error.message);
      throw error;
    }
  }

  // ─── PAY ELECTRICITY ─────────────────────────────────────────────────────

  /**
   * @param {object} payload
   * @param {string} payload.meter_number  - Customer meter number
   * @param {number} payload.amount        - Amount in NGN (min 1000 typically)
   * @param {string} payload.meter_type    - "prepaid" | "postpaid"
   * @param {string} payload.biller_name   - Distribution company e.g. "IKEDC", "EKEDC", "AEDC"
   * @param {string} payload.item_code     - From bill categories
   * @param {string} payload.pin           - User transaction PIN
   */
  async payElectricity({ meter_number, amount, meter_type, biller_name, item_code, pin }) {
    try {
      const pinCheck = await this._verifyPin(pin);
      if (!pinCheck.valid) {
        return { success: false, status: 400, message: pinCheck.message };
      }

      const wallet = await this._getNGNWallet();
      if (!wallet) return { success: false, status: 404, message: "NGN wallet not found" };
      if (Number(wallet.balance) < amount) {
        return { success: false, status: 400, message: "Insufficient wallet balance" };
      }

      // Validate meter number before charging
      const validation = await flutterwaveService.validateCustomer(item_code, meter_number);
      if (validation.status !== "success") {
        return { success: false, status: 400, message: "Invalid meter number" };
      }

      const reference = `ELEC-${this.user.id}-${uniqueId()}`;

      const flwResult = await flutterwaveService.createBillPayment({
        type: biller_name.toUpperCase(),
        customer: meter_number,
        amount,
        biller_name,
        reference,
      });

      if (flwResult.status !== "success") {
        return { success: false, status: 400, message: flwResult.message || "Electricity payment failed" };
      }

      await knex.transaction(async (trx) => {
        await this._debitWallet(trx, wallet.id, amount, reference, `${biller_name} electricity`);
        await transactionService.create({
          user_id: this.user.id,
          wallet_id: wallet.id,
          type: "DEBIT",
          category: "ELECTRICITY",
          amount,
          reference,
          status: "SUCCESS",
          narration: `${biller_name} ${meter_type} meter - ${meter_number}`,
          meta: {
            meter_number,
            meter_type,
            biller_name,
            item_code,
            customer_name: validation.data?.name,
            customer_address: validation.data?.address,
            token: flwResult.data?.token, // prepaid meter token
            flw_reference: flwResult.data?.flw_ref,
          },
          trx,
        });
      });

      return {
        success: true,
        status: 200,
        message: `Electricity payment successful`,
        data: {
          reference,
          meter_number,
          meter_type,
          customer_name: validation.data?.name,
          customer_address: validation.data?.address,
          amount,
          provider: biller_name,
          token: flwResult.data?.token, // prepaid meter token (important!)
          flw_reference: flwResult.data?.flw_ref,
        },
      };
    } catch (error) {
      console.error("payElectricity error:", error.message);
      throw error;
    }
  }

  // ─── GET TRANSACTION STATUS ───────────────────────────────────────────────

  async getBillStatus(reference) {
    try {
      const result = await flutterwaveService.getBillStatus(reference);

      return {
        success: true,
        status: 200,
        message: "Transaction status retrieved",
        data: result.data,
      };
    } catch (error) {
      console.error("getBillStatus error:", error.message);
      throw error;
    }
  }
}

module.exports = UtilitiesService;
