const ENDPOINTS = {
  BASE_URL: process.env.MONNIFY_BASE_URL || "https://sandbox.monnify.com/api",
  apiKey: process.env.MONNIFY_API_KEY,
  secretKey: process.env.MONNIFY_SECRET_KEY,
  contractCode: process.env.MONNIFY_CONTRACT_CODE,

  // Authentication
  AUTH: {
    RequestAccessToken: "/v1/auth/login",
  },

  // DVA - Dedicated Virtual Account
  DVA: {
    CreateDVA: "/v2/bank-transfer/reserved-accounts",
    GetDVA: (accountReference) =>
      `/v2/bank-transfer/reserved-accounts/${accountReference}`,
    DeleteDVA: (accountReference) =>
      `/v1/bank-transfer/reserved-accounts/reference/${accountReference}`,
    ListDVATransactions: `/v1/bank-transfer/reserved-accounts/transactions`,
    UpdateKYC: (accountReference) =>
      `/v1/bank-transfer/reserved-accounts/${accountReference}/kyc-info`,
  },

  // Transfers (Disbursements)
  TRANSFER: {
    InitiateTransfer: "/v2/disbursements/single",
  },
};

module.exports = ENDPOINTS;
