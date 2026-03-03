const axios = require("axios");
const https = require("https");

class ConduitService {
  constructor({ User, WalletAccount }) {
    if (!User || !WalletAccount) {
      throw new Error("ConduitService requires User and WalletAccount models");
    }

    this.User = User;
    this.WalletAccount = WalletAccount;

    // Use the official sandbox endpoint format
    const baseURL =
      process.env.CONDUIT_BASE_URL || "https://api.sandbox.getconduit.io/v1";

    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${process.env.CONDUIT_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15000,
    });
  }

  async onboardingFlow(businessLegalName) {
    const payload = {
      businessLegalName,
      country: "USA",
      onboardingFlow: "kyb_link",
    };

    try {
      const response = await this.client.post("/customers", payload);

      return {
        success: true,
        status: response.status,
        message: "Customer created successfully",
        data: response.data,
      };
    } catch (err) {
      console.error(
        "Conduit onboarding error:",
        err.response?.data || err.message,
      );

      return {
        success: false,
        status: err.response?.status || 500,
        message: "Failed to create customer",
        error: err.response?.data || err.message,
      };
    }
  }

  async createCustomer(user) {
    const payload = {
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      country: "US",
      type: "INDIVIDUAL",
    };

    console.log(
      `Calling Conduit POST ${this.client.defaults.baseURL}/customers`,
    );

    try {
      const { data } = await this.client.post("/customers", payload);
      console.log("Conduit createCustomer success:", data);

      if (!data?.id) {
        throw new Error("No ID returned from Conduit");
      }

      return data.id;
    } catch (error) {
      // Log specific error details from the response body if available
      const errorMsg = error.response?.data?.message || error.message;
      const status = error.response?.status;
      console.error(`Conduit Error [${status}]: ${errorMsg}`);

      throw new Error(`Conduit Customer Creation Failed: ${errorMsg}`);
    }
  }

  async createUsdVirtualAccount(customerId) {
    const payload = {
      customerId,
      currency: "USD",
      accountType: "VIRTUAL",
    };

    try {
      const { data } = await this.client.post("/virtual-accounts", payload);

      if (!data?.accountNumber) {
        throw new Error(
          "Failed to create USD virtual account: No account number",
        );
      }

      return {
        conduitAccountId: data.id,
        accountNumber: data.accountNumber,
        routingNumber: data.routingNumber,
        bankName: data.bankName,
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      throw new Error(`Conduit Account Creation Failed: ${errorMsg}`);
    }
  }

  async generateUsdWallet(user) {
    const existing = await this.WalletAccount.findOne({
      where: { user_id: user.id, currency: "USD" },
    });

    if (existing) return existing;

    let customerId = user.conduit_customer_id;

    if (!customerId) {
      customerId = await this.createCustomer(user);

      await this.User.update(
        { conduit_customer_id: customerId },
        { where: { id: user.id } },
      );
    }

    const account = await this.createUsdVirtualAccount(customerId);

    return this.WalletAccount.create({
      user_id: user.id,
      provider: "CONDUIT",
      currency: "USD",
      conduit_customer_id: customerId,
      conduit_account_id: account.conduitAccountId,
      account_number: account.accountNumber,
      routing_number: account.routingNumber,
      bank_name: account.bankName,
    });
  }
}

module.exports = ConduitService;
