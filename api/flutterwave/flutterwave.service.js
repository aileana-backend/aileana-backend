const axios = require("axios");

class FlutterwaveService {
  constructor() {
    this.secretKey = process.env.FLW_SECRET_KEY;
    this.baseURL = "https://api.flutterwave.com/v3";

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Get bill categories filtered by type and country
   * Types: AIRTIME | DATA_BUNDLE | DSTV | GOTV | STARTIMES | EKEDC | IKEDC | AEDC | PHEDC | etc.
   */
  async getBillCategories({ country = "NG", type } = {}) {
    try {
      const params = { country };
      if (type) params.type = type;

      const response = await this.client.get("/bill-categories", { params });
      return response.data;
    } catch (error) {
      console.error("FLW getBillCategories error:", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Validate a customer before payment (meter number, smartcard/decoder number)
   * @param {string} item_code - From bill categories (e.g. "AT099", "CB140")
   * @param {string} customer - Meter number or smartcard number
   */
  async validateCustomer(item_code, customer) {
    try {
      const response = await this.client.post(
        `/bill-items/${item_code}/validate`,
        { customer }
      );
      return response.data;
    } catch (error) {
      console.error("FLW validateCustomer error:", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create a bill payment (airtime, data, cable TV, electricity)
   * @param {object} payload
   * @param {string} payload.country        - "NG"
   * @param {string} payload.customer       - Phone number or meter/smartcard number
   * @param {number} payload.amount         - Amount in NGN
   * @param {string} payload.recurrence     - "ONCE"
   * @param {string} payload.type           - Bill type (AIRTIME, DATA_BUNDLE, etc.)
   * @param {string} payload.reference      - Unique payment reference
   * @param {string} payload.biller_name    - Provider name from bill categories
   */
  async createBillPayment(payload) {
    try {
      const response = await this.client.post("/bills", {
        recurrence: "ONCE",
        country: "NG",
        ...payload,
      });
      return response.data;
    } catch (error) {
      console.error("FLW createBillPayment error:", error.response?.data || error.message);
      throw error;
    }
  }

 
  async getBillStatus(reference) {
    try {
      const response = await this.client.get(`/bills/${reference}`);
      return response.data;
    } catch (error) {
      console.error("FLW getBillStatus error:", error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new FlutterwaveService();
