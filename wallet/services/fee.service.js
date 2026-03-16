const knex = require("../../config/pg");

/**
 * Fee keys — must match the fee_key column in platform_fees table
 */
const FEE_KEYS = {
  P2P_SMALL: "p2p_small",           // P2P transfer < ₦50,000  → ₦0
  P2P_LARGE: "p2p_large",           // P2P transfer >= ₦50,000 → 1–2%
  WALLET_WITHDRAWAL: "wallet_withdrawal", // Withdrawal >= ₦50,000 → ₦50 fixed
  PRODUCT_SALE: "product_sale",     // Marketplace product sale → 5%
  SERVICE_BOOKING: "service_booking", // Service booking → 7%
  FREELANCER_JOB: "freelancer_job", // Freelancer job → 10%
  ESCROW: "escrow",                 // Escrow → 1%
  BOOST_POST: "boost_post",         // Boosted post → ₦3,000–₦5,000 fixed range
  AFFILIATE: "affiliate",           // Affiliate share → 2–3% to user
};

class FeeService {
  /**
   * Load a fee config row from the database.
   */
  async getFeeConfig(feeKey) {
    return knex("platform_fees")
      .where({ fee_key: feeKey, is_active: true })
      .first();
  }

  /**
   * Calculate the platform fee for a given transaction amount and fee key.
   * Returns { feeKey, feeAmount } where feeAmount is in NGN.
   *
   * @param {string} feeKey  - one of FEE_KEYS
   * @param {number} amount  - transaction amount in NGN
   * @returns {{ feeKey: string, feeAmount: number }}
   */
  async calculate(feeKey, amount) {
    const config = await this.getFeeConfig(feeKey);
    if (!config) return { feeKey, feeAmount: 0 };

    // Threshold guards
    if (config.min_amount !== null && amount < parseFloat(config.min_amount)) {
      return { feeKey, feeAmount: 0 };
    }
    if (config.max_amount !== null && amount >= parseFloat(config.max_amount)) {
      return { feeKey, feeAmount: 0 };
    }

    let feeAmount = 0;

    if (config.rate_type === "fixed") {
      feeAmount = parseFloat(config.rate);
    } else {
      // percentage
      feeAmount = (parseFloat(config.rate) / 100) * amount;
      if (config.cap_amount !== null) {
        feeAmount = Math.min(feeAmount, parseFloat(config.cap_amount));
      }
    }

    return { feeKey, feeAmount: parseFloat(feeAmount.toFixed(2)) };
  }

  /**
   * Determine the correct fee key for a P2P transfer and calculate the fee.
   * - amount < 50,000 → p2p_small (₦0)
   * - amount >= 50,000 → p2p_large (1–2%)
   */
  async calculateP2PFee(amount) {
    const feeKey = amount < 50000 ? FEE_KEYS.P2P_SMALL : FEE_KEYS.P2P_LARGE;
    return this.calculate(feeKey, amount);
  }

  /**
   * Calculate withdrawal fee.
   * - amount >= 50,000 → ₦50 fixed
   * - amount < 50,000 → ₦0
   */
  async calculateWithdrawalFee(amount) {
    if (amount < 50000) return { feeKey: FEE_KEYS.WALLET_WITHDRAWAL, feeAmount: 0 };
    return this.calculate(FEE_KEYS.WALLET_WITHDRAWAL, amount);
  }

  /**
   * Calculate marketplace commission.
   * @param {"product_sale"|"service_booking"|"freelancer_job"} type
   * @param {number} amount
   */
  async calculateMarketplaceFee(type, amount) {
    const keyMap = {
      product_sale: FEE_KEYS.PRODUCT_SALE,
      service_booking: FEE_KEYS.SERVICE_BOOKING,
      freelancer_job: FEE_KEYS.FREELANCER_JOB,
    };
    const feeKey = keyMap[type];
    if (!feeKey) return { feeKey: type, feeAmount: 0 };
    return this.calculate(feeKey, amount);
  }

  /**
   * Calculate escrow fee (1%).
   */
  async calculateEscrowFee(amount) {
    return this.calculate(FEE_KEYS.ESCROW, amount);
  }
}

module.exports = new FeeService();
module.exports.FEE_KEYS = FEE_KEYS;
