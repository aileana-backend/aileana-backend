// const axios = require("axios");
// const ENDPOINTS = require("./endpoints.const");
// const HttpClientService = require("./http-client.service");
// const dvaValidationSchema = require("./validations/dva.validation");
// const transferValidationSchema = require("./validations/transfer.validation");
// const knex = require("../../config/pg");

// class MonnifyService extends HttpClientService {
//   constructor() {
//     super();
//     this.apiKey = process.env.MONNIFY_API_KEY;
//     this.clientSecret = process.env.MONNIFY_SECRET_KEY;
//     this.baseUrl =
//       process.env.MONNIFY_ENV === "live"
//         ? "https://api.monnify.com"
//         : "https://sandbox.monnify.com";
//   }

//   async createVirtualAccount(params) {
//     try {
//       const parsedParams = dvaValidationSchema.parse(params);
//       console.log("sending to monnify:", parsedParams); // ✅ add this
//       const response = await this.client.post(
//         ENDPOINTS.DVA.CreateDVA,
//         parsedParams,
//       );

//       return response.data;
//     } catch (error) {
//       if (error.response) {
//         const { status, data } = error.response;
//         if (data?.responseCode === "99") {
//           // ✅ paste here - replaces the old line
//           const existingAccount = await this.getVirtualAccount(
//             params.accountReference,
//           );
//           console.log("existing account", existingAccount);
//           return existingAccount;
//         }
//       }
//       this.handleError(error);

//       return false;
//     }
//   }

//   async getVirtualAccount(accountReference) {
//     try {
//       const response = await this.client.get(
//         ENDPOINTS.DVA.GetDVA(accountReference),
//       );
//       return response.data;
//     } catch (error) {
//       this.handleError(error);

//       return false;
//     }
//   }

//   // async transferFunds(params) {
//   //   try {
//   //     // Validate params using Zod schema
//   //     const parsedParams = transferValidationSchema.parse(params);
//   //     const response = await this.client.post(
//   //       ENDPOINTS.TRANSFER.InitiateTransfer,
//   //       parsedParams,
//   //     );
//   //     return response.data;
//   //   } catch (error) {
//   //     this.handleError(error);

//   //     return false;
//   //   }
//   // }

//   async getAccessToken() {
//     if (!this.apiKey || !this.clientSecret) {
//       throw new Error("Monnify API key or secret missing");
//     }

//     const authHeader = Buffer.from(
//       `${this.apiKey}:${this.clientSecret}`,
//     ).toString("base64");

//     try {
//       const res = await axios.post(
//         `${this.baseUrl}/api/v1/auth/login`,
//         {},
//         {
//           headers: { Authorization: `Basic ${authHeader}` },
//         },
//       );

//       const token = res?.data?.responseBody?.accessToken;
//       if (!token) throw new Error("Failed to get Monnify access token");

//       return token; // always return fresh token
//     } catch (err) {
//       console.error(
//         "Monnify authentication failed:",
//         err.response?.data || err.message,
//       );
//       throw new Error("Monnify authentication failed");
//     }
//   }

//   async validateBVN({ bvn, fullName, dateOfBirth, mobileNo }) {
//     const token = await this.getAccessToken();

//     try {
//       const res = await axios.post(
//         `${this.baseUrl}/api/v1/vas/bvn-details-match`,
//         { bvn, name: fullName, dateOfBirth, mobileNo },
//         { headers: { Authorization: `Bearer ${token}` } },
//       );

//       const body = res?.data?.responseBody;
//       if (!res?.data?.requestSuccessful || !body) {
//         return {
//           success: false,
//           message: res?.data?.responseMessage || "BVN validation failed",
//           data: null,
//         };
//       }

//       return { success: true, data: body };
//     } catch (err) {
//       console.error(
//         "BVN Validation Failed:",
//         err.response?.data || err.message,
//       );
//       return {
//         success: false,
//         message: err.response?.data?.responseMessage || err.message,
//         data: null,
//       };
//     }
//   }

//   async validateBankAccount(accountNumber, bankCode) {
//     const token = await this.getAccessToken();

//     try {
//       const res = await axios.get(
//         `https://sandbox.monnify.com/api/v1/disbursements/account/validate`,
//         {
//           headers: { Authorization: `Bearer ${token}` },
//           params: { accountNumber, bankCode }, // send as query parameters
//         },
//       );

//       const body = res?.data?.responseBody || null;
//       const requestSuccessful = res?.data?.requestSuccessful || false;

//       if (!requestSuccessful || !body) {
//         return {
//           success: false,
//           message: res?.data?.responseMessage || "Bank validation failed",
//           data: null,
//         };
//       }

//       return { success: true, data: body };
//     } catch (err) {
//       console.error(
//         "Bank validation error:",
//         err.response?.data || err.message,
//       );
//       return {
//         success: false,
//         message:
//           err.response?.data?.responseMessage ||
//           err.message ||
//           "Bank validation failed",
//         data: null,
//       };
//     }
//   }

//   async transferToExternalBank({
//     amount,
//     accountNumber,
//     bankCode,
//     narration,
//     reference,
//   }) {
//     const token = await this.getAccessToken();

//     try {
//       const res = await axios.post(
//         `${this.baseUrl}/api/v1/disbursements`,
//         {
//           amount,
//           accountNumber,
//           bankCode,
//           currency: "NGN",
//           reference,
//           narration,
//         },
//         { headers: { Authorization: `Bearer ${token}` } },
//       );

//       const body = res?.data?.responseBody;
//       if (!res?.data?.requestSuccessful || !body) {
//         return {
//           success: false,
//           message: res?.data?.responseMessage || "Transfer failed",
//           data: null,
//         };
//       }

//       return { success: true, data: body };
//     } catch (err) {
//       console.error(
//         "Monnify disbursement error:",
//         err.response?.data || err.message,
//       );
//       return {
//         success: false,
//         message: err.response?.data?.responseMessage || "Transfer failed",
//         data: null,
//       };
//     }
//   }

//   async getBanks() {
//     try {
//       const token = await this.getAccessToken();
//       const { data } = await axios.get(
//         `${this.baseUrl}/api/v1/sdk/transactions/banks`,
//         { headers: { Authorization: `Bearer ${token}` } },
//       );

//       return {
//         success: true,
//         status: 200,
//         message: "Banks retrieved successfully",
//         data: data.responseBody.map((bank) => ({
//           name: bank.name,
//           code: bank.code,
//         })),
//       };
//     } catch (error) {
//       console.error("getBanks error:", error.message);
//       throw error;
//     }
//   }

//   async resolveAccount(account_number, bank_code) {
//     try {
//       if (!account_number || !bank_code) {
//         return {
//           success: false,
//           status: 400,
//           message: "Account number and bank code are required",
//         };
//       }

//       // Uses your existing validateBankAccount method
//       const result = await this.validateBankAccount(account_number, bank_code);

//       if (!result.success) {
//         return {
//           success: false,
//           status: 404,
//           message: result.message || "Account not found",
//         };
//       }

//       return {
//         success: true,
//         status: 200,
//         message: "Account resolved successfully",
//         data: {
//           account_number: result.data.accountNumber,
//           account_name: result.data.accountName,
//           bank_code,
//         },
//       };
//     } catch (error) {
//       console.error("resolveAccount error:", error.message);
//       throw error;
//     }
//   }

//   async handleMonnifyWebhook(payload) {
//     try {
//       const {
//         eventType, // "SUCCESSFUL_DISBURSEMENT" | "FAILED_DISBURSEMENT" | "REVERSED_DISBURSEMENT"
//         eventData,
//       } = payload;

//       const reference = eventData?.transactionReference || eventData?.reference;
//       const monnifyStatus = eventData?.status;

//       if (!reference) {
//         console.warn("Monnify webhook: no reference found", payload);
//         return { success: false };
//       }

//       // Find the transaction by reference
//       const transaction = await knex("transactions")
//         .where({ reference })
//         .first();

//       if (!transaction) {
//         console.warn(
//           `Monnify webhook: transaction not found for reference ${reference}`,
//         );
//         return { success: false };
//       }

//       // Map Monnify event to your status
//       const statusMap = {
//         SUCCESSFUL_DISBURSEMENT: "completed",
//         FAILED_DISBURSEMENT: "failed",
//         REVERSED_DISBURSEMENT: "reversed",
//       };

//       const newStatus = statusMap[eventType] || "pending";

//       // Update transaction status
//       await knex("transactions")
//         .where({ reference })
//         .update({ status: newStatus, updated_at: new Date() });

//       // If transfer FAILED — reverse the wallet deduction
//       if (newStatus === "failed" || newStatus === "reversed") {
//         await knex.transaction(async (trx) => {
//           // Refund wallet balance
//           await trx("wallets")
//             .where({ id: transaction.wallet_id })
//             .increment("balance", parseFloat(transaction.amount));

//           // Add reversal ledger entry
//           const wallet = await trx("wallets")
//             .where({ id: transaction.wallet_id })
//             .first();

//           await trx("ledger_entries").insert({
//             transaction_id: transaction.id,
//             wallet_id: transaction.wallet_id,
//             entry_type: "reversal",
//             amount: transaction.amount,
//             balance_before:
//               parseFloat(wallet.balance) - parseFloat(transaction.amount),
//             balance_after: parseFloat(wallet.balance),
//             reference: `REV-${reference}`,
//             created_at: new Date(),
//             updated_at: new Date(),
//           });
//         });

//         console.log(`Transfer ${reference} ${newStatus} — wallet refunded`);
//       }

//       console.log(`Monnify webhook processed: ${reference} → ${newStatus}`);
//       return { success: true };
//     } catch (error) {
//       console.error("handleMonnifyWebhook error:", error.message);
//       throw error;
//     }
//   }

//   async getTransferStatus(reference) {
//     const token = await this.getAccessToken();

//     try {
//       const { data } = await axios.get(
//         `${this.baseUrl}/api/v2/disbursements/single/summary`,
//         {
//           params: { reference },
//           headers: { Authorization: `Bearer ${token}` },
//         },
//       );

//       return {
//         success: true,
//         data: data.responseBody,
//       };
//     } catch (err) {
//       console.error(
//         "getTransferStatus error:",
//         err.response?.data || err.message,
//       );
//       return {
//         success: false,
//         message: err.response?.data?.responseMessage || "Failed to get status",
//       };
//     }
//   }

//   //https://yourdomain.com/webhook/monnify
// }

// module.exports = new MonnifyService();

const axios = require("axios");
const ENDPOINTS = require("./endpoints.const");
const HttpClientService = require("./http-client.service");
const dvaValidationSchema = require("./validations/dva.validation");
const transferValidationSchema = require("./validations/transfer.validation");
const knex = require("../../config/pg");

class MonnifyService extends HttpClientService {
  constructor() {
    super();
    this.apiKey = process.env.MONNIFY_API_KEY;
    this.clientSecret = process.env.MONNIFY_SECRET_KEY;
    this.baseUrl =
      process.env.MONNIFY_ENV === "live"
        ? "https://api.monnify.com"
        : "https://sandbox.monnify.com";

    // Token cache
    this._cachedToken = null;
    this._tokenExpiresAt = null;
  }

  async getAccessToken() {
    if (!this.apiKey || !this.clientSecret) {
      throw new Error("Monnify API key or secret missing");
    }

    // Return cached token if still valid (60s buffer before expiry)
    if (
      this._cachedToken &&
      this._tokenExpiresAt &&
      Date.now() < this._tokenExpiresAt - 60000
    ) {
      return this._cachedToken;
    }

    const authHeader = Buffer.from(
      `${this.apiKey}:${this.clientSecret}`,
    ).toString("base64");

    try {
      const res = await axios.post(
        `${this.baseUrl}/api/v1/auth/login`,
        {},
        { headers: { Authorization: `Basic ${authHeader}` } },
      );

      const token = res?.data?.responseBody?.accessToken;
      const expiresIn = res?.data?.responseBody?.expiresIn; // in seconds

      if (!token) throw new Error("Failed to get Monnify access token");

      // Cache the token
      this._cachedToken = token;
      this._tokenExpiresAt =
        Date.now() + (expiresIn ? expiresIn * 1000 : 3600000); // fallback 1hr

      console.log(
        "Monnify: new token fetched, expires in",
        expiresIn,
        "seconds",
      );

      return token;
    } catch (err) {
      console.error(
        "Monnify authentication failed:",
        err.response?.data || err.message,
      );
      throw new Error("Monnify authentication failed");
    }
  }

  async createVirtualAccount(params) {
    try {
      const parsedParams = dvaValidationSchema.parse(params);
      console.log("sending to monnify:", parsedParams);
      const response = await this.client.post(
        ENDPOINTS.DVA.CreateDVA,
        parsedParams,
      );

      return response.data;
    } catch (error) {
      if (error.response) {
        const { status, data } = error.response;
        if (data?.responseCode === "99") {
          const existingAccount = await this.getVirtualAccount(
            params.accountReference,
          );
          console.log("existing account", existingAccount);
          return existingAccount;
        }
      }
      this.handleError(error);

      return false;
    }
  }

  async getVirtualAccount(accountReference) {
    try {
      const response = await this.client.get(
        ENDPOINTS.DVA.GetDVA(accountReference),
      );
      return response.data;
    } catch (error) {
      this.handleError(error);

      return false;
    }
  }

  async validateBVN({ bvn, fullName, dateOfBirth, mobileNo }) {
    const token = await this.getAccessToken();

    try {
      const res = await axios.post(
        `${this.baseUrl}/api/v1/vas/bvn-details-match`,
        { bvn, name: fullName, dateOfBirth, mobileNo },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const body = res?.data?.responseBody;
      if (!res?.data?.requestSuccessful || !body) {
        return {
          success: false,
          message: res?.data?.responseMessage || "BVN validation failed",
          data: null,
        };
      }

      return { success: true, data: body };
    } catch (err) {
      console.error(
        "BVN Validation Failed:",
        err.response?.data || err.message,
      );
      return {
        success: false,
        message: err.response?.data?.responseMessage || err.message,
        data: null,
      };
    }
  }

  async validateBankAccount(accountNumber, bankCode) {
    const token = await this.getAccessToken();

    try {
      const res = await axios.get(
        `https://sandbox.monnify.com/api/v1/disbursements/account/validate`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { accountNumber, bankCode },
        },
      );

      const body = res?.data?.responseBody || null;
      const requestSuccessful = res?.data?.requestSuccessful || false;

      if (!requestSuccessful || !body) {
        return {
          success: false,
          message: res?.data?.responseMessage || "Bank validation failed",
          data: null,
        };
      }

      return { success: true, data: body };
    } catch (err) {
      console.error(
        "Bank validation error:",
        err.response?.data || err.message,
      );
      return {
        success: false,
        message:
          err.response?.data?.responseMessage ||
          err.message ||
          "Bank validation failed",
        data: null,
      };
    }
  }

  async transferToExternalBank({
    amount,
    accountNumber,
    bankCode,
    narration,
    reference,
  }) {
    const token = await this.getAccessToken();

    try {
      const res = await axios.post(
        `${this.baseUrl}/api/v1/disbursements`,
        {
          amount,
          accountNumber,
          bankCode,
          currency: "NGN",
          reference,
          narration,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const body = res?.data?.responseBody;
      if (!res?.data?.requestSuccessful || !body) {
        return {
          success: false,
          message: res?.data?.responseMessage || "Transfer failed",
          data: null,
        };
      }

      return { success: true, data: body };
    } catch (err) {
      console.error(
        "Monnify disbursement error:",
        err.response?.data || err.message,
      );
      return {
        success: false,
        message: err.response?.data?.responseMessage || "Transfer failed",
        data: null,
      };
    }
  }

  async getBanks() {
    try {
      const token = await this.getAccessToken();
      const { data } = await axios.get(
        `${this.baseUrl}/api/v1/sdk/transactions/banks`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      return {
        success: true,
        status: 200,
        message: "Banks retrieved successfully",
        data: data.responseBody.map((bank) => ({
          name: bank.name,
          code: bank.code,
        })),
      };
    } catch (error) {
      console.error("getBanks error:", error.message);
      throw error;
    }
  }

  async resolveAccount(account_number, bank_code) {
    try {
      if (!account_number || !bank_code) {
        return {
          success: false,
          status: 400,
          message: "Account number and bank code are required",
        };
      }

      const result = await this.validateBankAccount(account_number, bank_code);

      if (!result.success) {
        return {
          success: false,
          status: 404,
          message: result.message || "Account not found",
        };
      }

      return {
        success: true,
        status: 200,
        message: "Account resolved successfully",
        data: {
          account_number: result.data.accountNumber,
          account_name: result.data.accountName,
          bank_code,
        },
      };
    } catch (error) {
      console.error("resolveAccount error:", error.message);
      throw error;
    }
  }

  async handleMonnifyWebhook(payload) {
    try {
      const { eventType, eventData } = payload;

      const reference = eventData?.transactionReference || eventData?.reference;
      const monnifyStatus = eventData?.status;

      if (!reference) {
        console.warn("Monnify webhook: no reference found", payload);
        return { success: false };
      }

      const transaction = await knex("transactions")
        .where({ reference })
        .first();

      if (!transaction) {
        console.warn(
          `Monnify webhook: transaction not found for reference ${reference}`,
        );
        return { success: false };
      }

      const statusMap = {
        SUCCESSFUL_DISBURSEMENT: "completed",
        FAILED_DISBURSEMENT: "failed",
        REVERSED_DISBURSEMENT: "reversed",
      };

      const newStatus = statusMap[eventType] || "pending";

      await knex("transactions")
        .where({ reference })
        .update({ status: newStatus, updated_at: new Date() });

      if (newStatus === "failed" || newStatus === "reversed") {
        await knex.transaction(async (trx) => {
          await trx("wallets")
            .where({ id: transaction.wallet_id })
            .increment("balance", parseFloat(transaction.amount));

          const wallet = await trx("wallets")
            .where({ id: transaction.wallet_id })
            .first();

          await trx("ledger_entries").insert({
            transaction_id: transaction.id,
            wallet_id: transaction.wallet_id,
            entry_type: "reversal",
            amount: transaction.amount,
            balance_before:
              parseFloat(wallet.balance) - parseFloat(transaction.amount),
            balance_after: parseFloat(wallet.balance),
            reference: `REV-${reference}`,
            created_at: new Date(),
            updated_at: new Date(),
          });
        });

        console.log(`Transfer ${reference} ${newStatus} — wallet refunded`);
      }

      console.log(`Monnify webhook processed: ${reference} → ${newStatus}`);
      return { success: true };
    } catch (error) {
      console.error("handleMonnifyWebhook error:", error.message);
      throw error;
    }
  }

  async getTransferStatus(reference) {
    const token = await this.getAccessToken();

    try {
      const { data } = await axios.get(
        `${this.baseUrl}/api/v2/disbursements/single/summary`,
        {
          params: { reference },
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      return {
        success: true,
        data: data.responseBody,
      };
    } catch (err) {
      console.error(
        "getTransferStatus error:",
        err.response?.data || err.message,
      );
      return {
        success: false,
        message: err.response?.data?.responseMessage || "Failed to get status",
      };
    }
  }
}

module.exports = new MonnifyService();
