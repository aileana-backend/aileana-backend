// fincra.service.js
const axios = require("axios");

class FincraService {
  constructor() {
    this.apiKey = process.env.FINCRA_SECRET_KEY;
    this.businessId = process.env.FINCRA_BUSINESS_ID;
    this.baseURL =
      process.env.NODE_ENV === "production"
        ? "https://api.fincra.com"
        : "https://sandboxapi.fincra.com";

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        "api-key": this.apiKey,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  }

  // ─────────────────────────────────────────
  // CREATE NGN VIRTUAL ACCOUNT
  // Instant — only needs BVN
  // ─────────────────────────────────────────
  async createNGNWallet(user) {
    try {
      const payload = {
        currency: "NGN",
        accountType: "individual",
        KYCInformation: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          bvn: user.bvn, // required for NGN
        },
        merchantReference: `ngn-${user.id}-${Date.now()}`, // unique per user
      };

      const response = await this.client.post(
        "/profile/virtual-accounts/requests",
        payload,
      );

      console.log("NGN wallet created:", response.data);
      return response.data;
    } catch (error) {
      console.error("Fincra NGN Error:", error.response?.data || error.message);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // CREATE USD VIRTUAL ACCOUNT
  // Requires KYC docs — passport + bank statement
  // URLs must be publicly accessible (S3/Cloudinary)
  // ─────────────────────────────────────────
  async createUSDWallet(user) {
    try {
      const payload = {
        currency: "USD",
        accountType: "individual",
        KYCInformation: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          dateOfBirth: user.dateOfBirth, // format: "DD-MM-YYYY"
          address: {
            street: user.address.street,
            city: user.address.city,
            state: user.address.state,
            country: user.address.country, // e.g "NG"
            zip: user.address.zip,
          },
        },
        meansOfId: [
          {
            type: "PASSPORT", // or "NATIONAL_ID", "DRIVERS_LICENSE"
            number: user.idNumber,
            url: user.idDocumentUrl, // publicly accessible URL (S3/Cloudinary)
          },
        ],
        bankStatement: [
          {
            url: user.bankStatementUrl,
          },
        ],
        merchantReference: `usd-${user.id}-${Date.now()}`,
      };

      const response = await this.client.post(
        "/profile/virtual-accounts/requests",
        payload,
      );

      console.log("USD wallet response:", response.data);

      return response.data;
    } catch (error) {
      console.error("Fincra USD Error:", error.response?.data || error.message);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // FETCH VIRTUAL ACCOUNT DETAILS
  // Call this after webhook confirms approval
  // ─────────────────────────────────────────
  async getWallet(virtualAccountId) {
    try {
      const response = await this.client.get(
        `/profile/virtual-accounts/${virtualAccountId}`,
      );
      return response.data;
    } catch (error) {
      console.error("Fincra fetch error:", error.response?.data);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // LIST ALL WALLETS FOR YOUR BUSINESS
  // ─────────────────────────────────────────
  async listWallets() {
    try {
      const response = await this.client.get(
        `/profile/virtual-accounts?businessId=${this.businessId}`,
      );
      return response.data;
    } catch (error) {
      console.error("Fincra list error:", error.response?.data);
      throw error;
    }
  }
}

module.exports = new FincraService();
