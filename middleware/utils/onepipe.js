const axios = require("axios");
const crypto = require("crypto");
const Wallet = require("../../models/Wallet");

const ONEPIPE_API_KEY = process.env.ONEPIPE_API_KEY || "";
const ONEPIPE_SECRET_KEY = process.env.ONEPIPE_API_SECRET || "";
const ONEPIPE_APP_CODE = process.env.ONEPIPE_APP_CODE || "";
const ONEPIPE_BASE_URL =
  process.env.ONEPIPE_BASE_URL || "https://api.onepipe.io";

const isMock = process.env.ONEPIPE_MOCK_MODE !== "live"; // so i can always change the mode to live in the .env

/**
 * Encrypt using Triple DES (des-ede3-cbc) as in OnePipe docs.
 */
function encryptTripleDES(secretKey, plainText) {
  if (!secretKey) throw new Error("encryptTripleDES: secretKey required");
  const bufferedKey = Buffer.from(secretKey, "utf16le");
  const key = crypto.createHash("md5").update(bufferedKey).digest();
  const newKey = Buffer.concat([key, key.slice(0, 8)]);
  const IV = Buffer.alloc(8, 0);
  const cipher = crypto.createCipheriv("des-ede3-cbc", newKey, IV);
  cipher.setAutoPadding(true);
  return cipher.update(plainText, "utf8", "base64") + cipher.final("base64");
}

/**
 * Signature header: MD5(request_ref;client_secret)
 */

function generateSignature(requestRef) {
  return crypto
    .createHash("md5")
    .update(`${requestRef};${ONEPIPE_SECRET_KEY}`)
    .digest("hex");
}

function uniqueRef(prefix = "ref") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

// so i dont always fill the One pipe request header

async function onepipeTransact(payload) {
  const headers = {
    "Content-Type": "application/json",
    "App-Code": ONEPIPE_APP_CODE,
    "Api-Key": ONEPIPE_API_KEY,
    Signature: generateSignature(payload.request_ref),
  };

  const { data } = await axios.post(
    `${ONEPIPE_BASE_URL}/v2/transact`,
    payload,
    { headers }
  );
  return data;
}

// Create wallet in my wallet database and in onepipe too

async function createWallet(user) {
  //if its mock and without the onepipe, it creates only for my database during mock
  if (isMock) {
    const externalId = `mock_wallet_${user._id.toString().slice(-6)}`;
    const wallet = new Wallet({
      user: user._id,
      externalId,
      balance: 0,
      currency: "NGN",
    });
    await wallet.save();
    return { status: "Successful", data: wallet };
  }

  const requestRef = uniqueRef("req");
  const transactionRef = uniqueRef("txn");

  const secureString = `${user.customer_ref};${user.provider_code}`; // e.g. "user_12345;FidelityVirtual"
  const encryptedSecure = encryptTripleDES(ONEPIPE_SECRET_KEY, secureString);

  const payload = {
    request_ref: requestRef,
    request_type: "open_account",
    auth: {
      type: "basic",
      secure: encryptedSecure,
      auth_provider: user.provider_name || "FidelityVirtual",
    },
    transaction: {
      mock_mode: isMock ? "inspect" : "live",
      transaction_ref: transactionRef,
      transaction_desc: "Wallet creation",
      transaction_ref_parent: null,
      amount: 0,
      customer: {
        customer_ref: user._id,
        firstname: user?.firstname,
        surname: user?.surname,
        email: user?.email,
        mobile_no: user?.phone,
      },
      meta: {
        a_key: "a_meta_value_1",
        another_key: "a_meta_value_2",
      },
      details: {
        name_on_account: user?.name,
        middlename: user?.middlename,
        dob: user?.dob,
        gender: user?.gender,
        title: user?.title,
        address_line_1: user?.address_line_1,
        address_line_2: user?.address_line_2,
        city: user?.city,
        state: user?.state,
        country: user?.country,
      },
    },
  };

  const response = await onepipeTransact(payload);

  if (response.status === "Successful" && response.data.errors?.length === 0) {
    const accountNumber = response.data.provider_response?.account_number;
    const currency = response.data.provider_response?.currency || "NGN";
    const wallet = new Wallet({
      user: user._id,
      externalId: accountNumber,
      balance: 0,
      currency,
    });
    await wallet.save();
    return response;
  }

  throw new Error(response.message || "Wallet creation failed");
}

/**
 * Retrieve wallet balance (wallet_balance in OnePipe v2)
 */
async function getWalletBalance(wallet) {
  if (isMock) {
    return { status: "Successful", balance: 5000, currency: "NGN" };
  }

  const requestRef = uniqueRef("req");
  const transactionRef = uniqueRef("txn");

  const secureString = `${wallet.externalId};${wallet.provider}`;
  const encryptedSecure = encryptTripleDES(ONEPIPE_SECRET_KEY, secureString);

  const payload = {
    request_ref: requestRef,
    request_type: "wallet_balance",
    auth: {
      type: "basic",
      secure: encryptedSecure,
      auth_provider: wallet.provider || "FidelityVirtual",
    },
    transaction: {
      mock_mode: isMock ? "inspect" : "live",
      transaction_ref: transactionRef,
      transaction_desc: "Wallet Balance Check",
    },
  };

  const response = await onepipeTransact(payload);
  return {
    status: response.status,
    balance: response.data?.provider_response?.balance || 0,
    currency: response.data?.provider_response?.currency || "NGN",
  };
}

module.exports = { createWallet, getWalletBalance };
