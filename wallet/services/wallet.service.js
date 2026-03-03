const { contractCode } = require("../../api/monnify/endpoints.const");
const monnifyService = require("../../api/monnify/monnify.service");
const logActivity = require("../../utils/activityLogger");
const { encrypt, decryptText } = require("../../utils/encrypter");
const { Types } = require("mongoose");
const ledgerService = require("./ledger.service");
const transactionService = require("./transaction.service");
const { uniqueId } = require("../../utils/string.util");
const knex = require("../../config/pg");
const sendEmail = require("../../utils/sendMail");
const { generateOTPTemplate } = require("../../controllers/authController");
const cloudinary = require("../../config/cloudinary");
const smileClient = require("../../config/smile-client");
const QRCode = require("qrcode");
const bcrypt = require("bcrypt");

class WalletService {
  constructor(user) {
    this.user = user;
  }

  async findOne(id) {
    try {
      const wallet = await knex("wallet")
        .where({
          id,
          status: WalletStatus.Active,
          isDeleted: false,
        })
        .first(); // same as findFirst

      if (!wallet) throw new Error("Wallet not found");

      return wallet;
    } catch (error) {
      console.error("Error finding wallet:", error);
      return false;
    }
  }

  async findByUserId(userId = "") {
    try {
      if (!userId) throw new Error("Invalid User ID: User ID is required.");

      const wallet = await knex("wallet")
        .where({
          userId,
          status: WalletStatus.Active,
          isDeleted: false,
        })
        .first();

      return wallet;
    } catch (error) {
      console.error("Error: Unable to find user wallet.", error);
      return false;
    }
  }

  async getBalance(userId) {
    if (!userId) throw new Error("Invalid user ID");

    const wallet = await knex("wallet")
      .where({
        userId,
        status: "Active",
        isDeleted: false,
      })
      .first();

    if (!wallet) throw new Error("Wallet not found");

    return wallet.balance;
  }

  async creditWallet(
    walletId = "",
    amount = 0,
    fees = 0,
    reference = "",
    desc = "Transaction successful",
    meta = {},
  ) {
    if (!walletId) throw new Error("Invalid wallet ID");
    if (amount <= 0) throw new Error("Invalid credit amount");
    if (!reference) throw new Error("Transaction reference is required");

    const userWallet = await this.findOne(walletId);
    if (!userWallet) throw new Error("User wallet not found");

    const result = await knex.transaction(async (trx) => {
      // 🔒 Lock wallet row
      const currentWallet = await trx("wallet")
        .where({
          userId: userWallet.userId,
          isDeleted: false,
        })
        .forUpdate()
        .first();

      if (!currentWallet) throw new Error("Wallet not found");

      // Validate ledger
      const ledgerValidation =
        await ledgerService.validateLedgerInflowOutflowConsistency(trx, {
          walletId: userWallet.id,
        });

      if (!ledgerValidation.valid)
        throw new Error("Ledger inconsistency detected");

      // Create transaction
      const transaction = await transactionService.createTransaction(trx, {
        userId: userWallet.userId,
        walletId: userWallet.id,
        amount,
        type: "Deposit",
        flow: "Inflow",
        reference,
        fees,
        status: "Pending",
        description: desc,
        metadata: meta,
      });

      if (!transaction) throw new Error("Could not create transaction");

      const decryptedBalance = parseFloat(
        decryptText(currentWallet.balance, process.env.ENCRYPTION_KEY),
      );

      if (isNaN(decryptedBalance))
        throw new Error("Could not decrypt wallet balance");

      const newBalance = decryptedBalance + transaction.totalAmount;

      // Update wallet balance
      await trx("wallet")
        .where({ id: userWallet.id })
        .update({ balance: newBalance });

      // Log ledger
      await ledgerService.logLedgerCreditEntry(trx, {
        walletId: userWallet.id,
        transactionId: transaction.id,
        credit: transaction.totalAmount,
        prevBalance: decryptedBalance,
        currBalance: newBalance,
      });

      // Update transaction status
      await transactionService.updateTransactionStatus(trx, {
        transactionId: transaction.id,
        status: "Completed",
      });

      return newBalance;
    });

    return this.findOne(userWallet.id);
  }

  async debitWallet(
    walletId = "",
    amount = 0,
    fees = 0,
    reference = "",
    desc = "Transaction successful",
    meta = {},
  ) {
    if (!walletId) throw new Error("Invalid wallet ID");
    if (amount <= 0) throw new Error("Invalid debit amount");
    if (!reference) throw new Error("Transaction reference is required");

    const userWallet = await this.findOne(walletId);
    if (!userWallet) throw new Error("User wallet not found");

    const result = await knex.transaction(async (trx) => {
      const currentWallet = await trx("wallet")
        .where({
          userId: userWallet.userId,
          isDeleted: false,
        })
        .forUpdate()
        .first();

      if (!currentWallet) throw new Error("Wallet not found");

      const decryptedBalance = parseFloat(
        decryptText(currentWallet.balance, process.env.ENCRYPTION_KEY),
      );

      const transaction = await transactionService.createTransaction(trx, {
        userId: userWallet.userId,
        walletId: userWallet.id,
        amount,
        type: "Withdrawal",
        flow: "Debit",
        reference,
        fees,
        status: "Pending",
        description: desc,
        metadata: meta,
      });

      const newBalance = decryptedBalance - transaction.totalAmount;

      if (newBalance < 0) throw new Error("Insufficient funds");

      await trx("wallet")
        .where({ id: userWallet.id })
        .update({ balance: newBalance });

      await ledgerService.logLedgerDebitEntry(trx, {
        walletId: userWallet.id,
        transactionId: transaction.id,
        debit: transaction.totalAmount,
        prevBalance: decryptedBalance,
        currBalance: newBalance,
      });

      await transactionService.updateTransactionStatus(trx, {
        transactionId: transaction.id,
        status: "Successful",
      });

      return newBalance;
    });

    return this.findOne(userWallet.id);
  }

  async transferP2P(payload) {
    try {
      const {
        walletId,
        amount,
        receiverWalletId,
        desc = "P2P Transfer",
      } = payload;

      if (amount <= 0)
        return {
          success: false,
          status: 400,
          message: "Amount must be greater than zero",
        };

      // Fetch sender wallet
      const senderWallet = await knex("wallet")
        .where({ id: walletId, isDeleted: false, status: "Active" })
        .first();

      if (!senderWallet)
        return {
          success: false,
          status: 404,
          message: "Sender wallet not found",
        };

      // Fetch receiver wallet
      const receiverWallet = await knex("wallet")
        .where({
          walletAddress: receiverWalletId,
          isDeleted: false,
          status: "Active",
        })
        .first();

      if (!receiverWallet)
        return {
          success: false,
          status: 404,
          message: "Receiver wallet not found",
        };

      const baseReference = `P2P_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`;

      // Start Knex transaction
      const transactionResult = await knex.transaction(async (trx) => {
        // Lock sender wallet row
        const senderLocked = await trx("wallet")
          .where({ id: senderWallet.id })
          .forUpdate()
          .first();

        const senderNewBalance = senderLocked.balance - amount;
        if (senderNewBalance < 0) throw new Error("Insufficient funds");

        // Create sender transaction
        const senderTransaction = await transactionService.createTransaction(
          trx,
          {
            userId: senderWallet.userId,
            walletId: senderWallet.id,
            amount,
            type: "Withdrawal",
            flow: "Outflow",
            reference: `${baseReference}-DEBIT`,
            status: "Pending",
            description: desc,
          },
        );

        // Update sender balance
        await trx("wallet")
          .where({ id: senderWallet.id })
          .update({ balance: senderNewBalance });

        // Log ledger debit
        await ledgerService.logLedgerDebitEntry(trx, {
          walletId: senderWallet.id,
          transactionId: senderTransaction.id,
          debit: amount,
          prevBalance: senderWallet.balance,
          currBalance: senderNewBalance,
        });

        // Lock receiver wallet row
        const receiverLocked = await trx("wallet")
          .where({ id: receiverWallet.id })
          .forUpdate()
          .first();

        const receiverNewBalance = receiverLocked.balance + amount;

        // Create receiver transaction
        const receiverTransaction = await transactionService.createTransaction(
          trx,
          {
            userId: receiverWallet.userId,
            walletId: receiverWallet.id,
            amount,
            type: "Deposit",
            flow: "Inflow",
            reference: `${baseReference}-CREDIT`,
            status: "Pending",
            description: desc,
          },
        );

        // Update receiver balance
        await trx("wallet")
          .where({ id: receiverWallet.id })
          .update({ balance: receiverNewBalance });

        // Log ledger credit
        await ledgerService.logLedgerCreditEntry(trx, {
          walletId: receiverWallet.id,
          transactionId: receiverTransaction.id,
          credit: amount,
          prevBalance: receiverWallet.balance,
          currBalance: receiverNewBalance,
        });

        return {
          success: true,
          status: 200,
          message: "Transfer successful",
          data: {
            senderWallet: senderNewBalance,
            receiverWallet: receiverNewBalance,
          },
        };
      });

      return transactionResult;
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: error.message || "Internal Server Error",
        data: null,
      };
    }
  }

  async getEncryptedWallet(userId) {
    try {
      if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid user ID");
      const wallet = await this.findOne(userId);
      if (!wallet) throw new Error("Wallet not found");
      return encrypt({ balance: wallet.balance, id: wallet.id });
    } catch (err) {
      console.error(`[WalletService][getEncryptedWallet]`, err);
      return false;
    }
  }

  async freezeWallet(userId) {
    // TODO: Implement wallet freezing logic
    throw new Error("Not implemented");
  }

  async unfreezeWallet(userId) {
    // TODO: Implement wallet unfreezing logic
    throw new Error("Not implemented");
  }

  async setSpendingLimit(userId, limit) {
    // TODO: Implement spending limit logic
    throw new Error("Not implemented");
  }

  async fundNGNWallet() {
    const user = await User.findById(this.user._id);
    if (!user)
      return {
        success: false,
        status: 404,
        message: "User not found",
      };

    if (this.user.bvn === null || this.user.bvn === undefined) {
      return {
        success: false,
        status: 400,
        message: "BVN is required to create a wallet",
      };
    }

    if (this.user.status !== "active") {
      return {
        success: false,
        status: 403,
        message: "User account is not active. Please contact support.",
      };
    }

    const walletPayload = {
      accountName: `${user.first_name} ${user.last_name}`.trim(),
      customerName: `${user.first_name} ${user.last_name}`.trim(),
      customerEmail: String(user.email),
      currencyCode: String(currency),
      contractCode: String(process.env.MONNIFY_CONTRACT_CODE),
      accountReference: `AILEANA_${this.user._id.toString()}_${Date.now()}`,
      getAllAvailableBanks: true,
      bvn: user?.bvn ? String(user.bvn) : undefined,
      accountReference: `AILEANA_NGN_${this.user._id}}`,
      currencyCode: `${currency.toUpperCase()}`,
    };

    const response = await monnifyService.createVirtualAccount(walletPayload);

    const { accounts } = response.responseBody;
    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new Error("No account data returned from Monnify");
    }

    const walletData = accounts[0];

    // 5. Database Persistence
    const wallet = await prismadb.wallet.create({
      data: {
        userId: user.id,
        walletAddress: String(walletData.accountNumber),
        walletAddressName: String(walletData.bankName),
        walletAddressId: String(walletData.bankCode),
        walletAddressTag: String(walletData.accountName),
        status: "Active",
        balance: "0.0",
        accountReference: walletPayload.accountReference,
        currencyCode: walletPayload.currencyCode,
      },
    });

    return {
      success: true,
      status: 200,
      message: `${currency} wallet created successfully`,
      data: {
        wallet,
      },
    };
  }

  async getWallet() {
    const wallet = await knex("wallet")
      .where({
        userId: this.user._id.toString(),
        isDeleted: false,
        status: "Active",
      })
      .first();

    if (!wallet) {
      return {
        success: false,
        status: 404,
        message: "Wallet not found",
        data: null,
      };
    }

    const response = await monnifyService.getVirtualAccount(
      wallet.accountReference,
    );

    return {
      success: true,
      status: 200,
      message: "Wallet retrieved successfully",
      data: {
        wallet,
        accountDetails: response.responseBody,
      },
    };
  }

  async initiateNairaWalletKYC(payload) {
    const { address, city, state, phone_number, bvn } = payload;

    const user = await knex("users")
      .where({ id: this.user.id }) // UUID
      .first();

    if (!user) {
      return {
        success: false,
        status: 404,
        message: "User not found",
      };
    }

    await knex("users").where({ id: this.user.id }).update({
      address,
      city,
      state,
      phone_number,
      bvn,
      updated_at: knex.fn.now(),
    });

    // 3️⃣ Prepare Monnify payload
    const walletPayload = {
      accountName: `${user.first_name} ${user.last_name}`,
      customerName: `${user.first_name} ${user.last_name}`,
      customerEmail: user.email,
      currencyCode: "NGN",
      contractCode: contractCode,
      accountReference: `AILEANA_${user.id}`,
      getAllAvailableBanks: true,
      bvn,
      currency: "NGN",
    };

    const response = await monnifyService.createVirtualAccount(walletPayload);

    if (!response.requestSuccessful) {
      throw new Error("Could not create wallet");
    }

    const { accounts } = response.responseBody;

    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new Error("Could not create wallet");
    }

    const walletData = accounts[0];

    // 4️⃣ Insert wallet
    const [wallet] = await knex("wallets")
      .insert({
        user_id: user.id,
        currency_code: "NGN",
        wallet_type: "FIAT",
        wallet_address: walletData.accountNumber,
        wallet_address_name: walletData.accountName,
        wallet_address_id: walletData.bankCode,
        bank_name: walletData.bankName,
        wallet_address_tag: "",
        status: "active",
        balance: "0.0",
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      })
      .returning("*");

    if (!wallet) {
      throw new Error("Could not create wallet");
    }

    // 5️⃣ Send OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const subject = "Naira wallet KYC verification OTP";
    const htmlContent = generateOTPTemplate(user.first_name, otp);
    await knex("users").where({ id: this.user.id }).update({
      otp,
      otp_type: "kyc-otp",
      //kyc_otp_expires_at: otpExpiresAt,
      updated_at: knex.fn.now(),
    });

    await sendEmail(user.email, subject, htmlContent);

    return {
      success: true,
      status: 200,
      message: "Verification OTP sent to your mail",
      data: null,
    };
  }

  async transferFunds(params) {
    const {
      amount,
      narration,
      destinationBankCode,
      destinationAccountNumber,
      currency,
      sourceAccountNumber,
    } = params;

    const response = await monnifyService.transferFunds(params);

    return {
      success: true,
      status: 200,
      message: "Funds transfered successfully",
      data: {
        wallet,
        accountDetails: response.responseBody,
      },
    };
  }

  async getAllCreatedWallets() {
    const wallets = await knex("wallets").where({
      user_id: this.user.id,
      is_deleted: false,
      status: "active",
    });

    if (!wallets || wallets.length === 0) {
      return {
        success: true,
        status: 200,
        message: "No wallets found",
        data: [],
      };
    }

    return {
      success: true,
      status: 200,
      message: "Wallets retrieved successfully",
      data: wallets,
    };
  }

  async validateBvn(params) {
    console.log("Validating BVN with params:", params);
    const response = await monnifyService.validateBVN(params);
    console.log("BVN Validation Response:", response);

    return {
      success: true,
      status: 200,
      message: "BVN validated successfully",
      data: response.data.responseBody,
    };
  }

  async validateBankAccount(accountNumber, bankCode) {
    const response = await monnifyService.validateBankAccount(
      accountNumber,
      bankCode,
    );

    return {
      success: true,
      status: 200,
      message: "Bank account validated successfully",
      data: response.data.responseBody,
    };
  }

  async sendToExternalAccount({
    amount,
    accountNumber,
    accountName,
    bankCode,
    pin,
    narration,
  }) {
    try {
      const verify = await new Auth(this.user).verifyPINPassword("pin", pin);
      if (!verify.success) {
        return { success: false, status: 400, message: verify.message };
      }

      const knex = TransactionModel.knex();
      const txnReference = `TRF-${this.user.id}-${Date.now()}`;

      // 2. Get wallet
      const wallet = await knex("wallets")
        .where({
          user_id: this.user.id,
          wallet_type: "FIAT",
          currency_code: "NGN",
          is_deleted: false,
        })
        .first();

      if (!wallet) {
        return { success: false, status: 404, message: "Wallet not found" };
      }

      const transferAmount = parseFloat(amount);
      const balanceBefore = parseFloat(wallet.balance);

      if (balanceBefore < transferAmount) {
        return { success: false, status: 400, message: "Insufficient balance" };
      }

      const balanceAfter = balanceBefore - transferAmount;

      // 3. Call Monnify BEFORE opening transaction
      // (external API calls should never be inside a DB transaction)
      const result = await monnifyService.sendToExternalAccount({
        amount: transferAmount,
        accountNumber,
        bankCode,
        narration: narration || `Transfer to ${accountName}`,
        reference: txnReference,
      });

      if (!result.success) {
        return {
          success: false,
          status: 400,
          message: result.message || "Transfer failed",
        };
      }

      // 4. DB transaction — rollback everything if any step fails
      const savedData = await knex.transaction(async (trx) => {
        // Deduct wallet balance
        await trx("wallets")
          .where({ id: wallet.id })
          .update({ balance: balanceAfter, updated_at: new Date() });

        // Save to transactions table
        const [transaction] = await trx("transactions")
          .insert({
            user_id: this.user.id,
            wallet_id: wallet.id,
            transaction_type: "transfer",
            reference: txnReference,
            amount: transferAmount,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            status: "completed",
            description: narration || `Transfer to ${accountName}`,
            metadata: JSON.stringify({
              account_number: accountNumber,
              account_name: accountName,
              bank_code: bankCode,
              monnify_ref: result.data?.transactionReference || null,
            }),
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning("*");

        // Save to ledger_entries table
        await trx("ledger_entries").insert({
          transaction_id: transaction.id,
          wallet_id: wallet.id,
          entry_type: "debit",
          amount: transferAmount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          reference: txnReference,
          created_at: new Date(),
          updated_at: new Date(),
        });

        return transaction;
      });

      return {
        success: true,
        status: 200,
        message: "Funds processed successfully",
        data: {
          reference: txnReference,
          amount: transferAmount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          account_name: accountName,
          account_number: accountNumber,
          status: result.data?.status || "PENDING",
        },
      };
    } catch (error) {
      console.error("sendToExternalAccount error:", error.message);
      throw error;
    }
  }

  async onboardingFlow(businessLegalName) {
    try {
      const result = await conduitService.onboardingFlow(businessLegalName);

      return result;
    } catch (error) {
      console.error("[OnboardingFlow Error]", error);

      return {
        success: false,
        status: error?.status || 500,
        message: error.message || "Failed to generate onboarding link",
      };
    }
  }

  async uploadIDDocument({ id_type, file, selfie, id_number }) {
    try {
      const user = await User.findById(this.user._id);
      if (!user)
        return { success: false, status: 404, message: "User not found" };

      // 1. Upload ID image to Cloudinary
      const uploadedID = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: "kyc_documents/id" }, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          })
          .end(file.buffer);
      });

      // 2. Upload selfie to Cloudinary
      const uploadedSelfie = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            { folder: "kyc_documents/selfie" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            },
          )
          .end(selfie.buffer);
      });

      // 3. Send to Smile Identity for verification
      const partnerParams = {
        user_id: user._id.toString(),
        job_id: `JOB_${user._id}_${Date.now()}`,
        job_type: 1, // 1 = biometric KYC (face + ID verification)
      };

      const idInfo = {
        first_name: user.first_name,
        last_name: user.last_name,
        country: "NG",
        id_type: id_type.toUpperCase(), // "DRIVERS_LICENSE", "NATIONAL_ID", "PASSPORT"
        id_number: id_number, // the actual ID number
      };

      const imageDetails = [
        {
          image_type_id: 2, // selfie
          image: uploadedSelfie.secure_url,
        },
        {
          image_type_id: 1, // ID card front
          image: uploadedID.secure_url,
        },
      ];

      const options = {
        return_job_status: true,
      };

      const smileResponse = await smileClient.submit_job(
        partnerParams,
        imageDetails,
        idInfo,
        options,
      );

      console.log("smile response:", smileResponse);

      // 4. Update user kyc status
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            "kyc_document.type": id_type,
            "kyc_document.front_image_url": uploadedID.secure_url,
            "kyc_document.selfie_url": uploadedSelfie.secure_url,
            "kyc_document.status": "pending",
            "kyc_document.uploaded_at": new Date(),
            "kyc_document.job_id": partnerParams.job_id,
          },
        },
      );

      return {
        success: true,
        data: {
          status: "pending",
          message: "Verification submitted, reviewing your data",
        },
      };
    } catch (error) {
      console.error("KYC upload error:", error);
      return { success: false, status: 500, message: error.message };
    }
  }

  async getWalletByType(type, subtype = null) {
    const normalizedType = type?.toLowerCase()?.trim();

    const validTypes = ["naira", "dollar", "digital"];
    if (!normalizedType || !validTypes.includes(normalizedType)) {
      return {
        success: false,
        status: 400,
        message: `Invalid wallet type. Must be one of: ${validTypes.join(", ")}`,
      };
    }

    if (normalizedType === "digital") {
      const normalizedSubtype = subtype?.toUpperCase()?.trim();

      const validSubtypes = ["TRADEBITS", "CREDIX"];

      // If subtype provided, validate it
      if (normalizedSubtype && !validSubtypes.includes(normalizedSubtype)) {
        return {
          success: false,
          status: 400,
          message: `Invalid subtype. Must be one of: tradebits, credix`,
        };
      }

      // Build wallet query — filter by subtype if provided
      let walletQuery = knex("wallets").where({
        user_id: this.user.id,
      });

      if (normalizedSubtype) {
        walletQuery = walletQuery.where({ wallet_type: normalizedSubtype });
      } else {
        walletQuery = walletQuery.whereIn("wallet_type", [
          "TRADEBITS",
          "CREDIX",
        ]);
      }

      const digitalWallets = await walletQuery;

      if (!digitalWallets || digitalWallets.length === 0) {
        return {
          success: false,
          status: 404,
          message: `No ${subtype || "digital"} wallet found for this user`,
        };
      }

      const walletsWithTxns = await Promise.all(
        digitalWallets.map(async (wallet) => {
          const transactions = await knex("transactions")
            .where({ wallet_id: wallet.id })
            .orderBy("created_at", "desc")
            .limit(20);

          return { ...wallet, transactions };
        }),
      );

      // If subtype was specified return single object, else return array
      return {
        success: true,
        status: 200,
        message: `${subtype || "Digital"} wallet retrieved successfully`,
        data: normalizedSubtype ? walletsWithTxns[0] : walletsWithTxns,
      };
    }
  }

  async getBanks() {
    try {
      const banks = await monnifyService.getBanks();
      return {
        success: true,
        status: 200,
        message: "Banks retrieved successfully",
        data: banks,
      };
    } catch (error) {
      console.error("getBanks error:", error.message);
      throw error;
    }
  }

  async resolveAccount(account_name, bank_code) {
    try {
      const result = await monnifyService.resolveAccount(
        account_name,
        bank_code,
      );
      console.log("servise", result);

      return {
        success: true,
        status: 200,
        message: "Account resolved successfully",
        data: result.data,
      };
    } catch (error) {
      console.error("resolve account error:", error.message);
      throw error;
    }
  }

  async transferToExternalBank({
    account_number,
    bank_code,
    account_name,
    amount,
    narration,
    pin,
  }) {
    try {
      // Verify PIN
      const verify = await new Auth(this.user).verifyPINPassword("pin", pin);
      if (!verify.success) {
        return { success: false, status: 400, message: verify.message };
      }

      // Check wallet balance
      const knex = TransactionModel.knex();
      const wallet = await knex("wallets")
        .where({
          user_id: this.user.id,
          wallet_type: "FIAT",
          currency_code: "NGN",
          is_deleted: false,
        })
        .first();

      if (!wallet) {
        return { success: false, status: 404, message: "Wallet not found" };
      }

      if (parseFloat(wallet.balance) < parseFloat(amount)) {
        return { success: false, status: 400, message: "Insufficient balance" };
      }

      const reference = `TRF-${this.user.id}-${Date.now()}`;

      // Uses your existing sendToExternalAccount method
      const result = await monnifyService.transferToExternalBank({
        amount,
        accountNumber: account_number,
        bankCode: bank_code,
        narration: narration || `Transfer to ${account_name}`,
        reference,
      });

      if (!result.success) {
        return {
          success: false,
          status: 400,
          message: result.message || "Transfer failed",
        };
      }

      // Deduct balance
      await knex("wallets")
        .where({ id: wallet.id })
        .decrement("balance", parseFloat(amount));

      // Record transaction
      await knex("transactions").insert({
        user_id: this.user.id,
        wallet_id: wallet.id,
        amount,
        type: "debit",
        status: "success",
        reference,
        description: `Transfer to ${account_name} - ${bank_code}`,
        created_at: new Date(),
      });

      return {
        success: true,
        status: 200,
        message: "Transfer initiated successfully",
        data: {
          reference,
          amount,
          account_name,
          account_number,
          status: result.data?.status || "PENDING",
        },
      };
    } catch (error) {
      console.error("transferFunds error:", error.message);
      throw error;
    }
  }

  async createTransactionPin(pin, confirmPin) {
    try {
      // 1. Validate inputs
      if (!pin || !confirmPin) {
        return {
          success: false,
          status: 400,
          message: "Pin and confirm pin are required",
        };
      }

      if (pin.length !== 4 || !/^\d+$/.test(pin)) {
        return {
          success: false,
          status: 400,
          message: "Pin must be exactly 4 digits",
        };
      }

      if (pin !== confirmPin) {
        return {
          success: false,
          status: 400,
          message: "Pin and confirm pin do not match",
        };
      }

      // 2. Check if user already has a PIN
      // const knex = TransactionModel.knex();
      // const user = await knex("users").where({ id: this.user.id }).first();
      const user = await User.findById(this.user.id);

      if (user.transaction_pin) {
        return {
          success: false,
          status: 400,
          message: "Transaction pin already exists. Use change pin instead",
        };
      }

      // 3. Hash the PIN
      const hashedPin = await bcrypt.hash(pin, 10);

      // 4. Save to DB
      await knex("users").where({ id: this.user.id }).update({
        transaction_pin: hashedPin,
        updated_at: new Date(),
      });

      return {
        success: true,
        status: 200,
        message: "Transaction pin created successfully",
      };
    } catch (error) {
      console.error("createTransactionPin error:", error.message);
      throw error;
    }
  }

  async getTransferStatus(reference) {
    try {
      if (!reference) {
        return {
          success: false,
          status: 400,
          message: "Reference is required",
        };
      }

      const result = await monnifyService.getTransferStatus(reference);

      if (!result.success) {
        return { success: false, status: 400, message: result.message };
      }

      // Also update your DB with latest status
      // const knex = TransactionModel.knex();
      const statusMap = {
        SUCCESS: "completed",
        FAILED: "failed",
        PENDING: "pending",
        PROCESSING: "processing",
        REVERSED: "reversed",
      };

      const newStatus = statusMap[result.data?.status] || "pending";

      await knex("transactions")
        .where({ reference })
        .update({ status: newStatus, updated_at: new Date() });

      return {
        success: true,
        status: 200,
        message: "Transfer status retrieved",
        data: {
          reference,
          status: newStatus,
          amount: result.data?.amount,
          narration: result.data?.narration,
          account_number: result.data?.destinationAccountNumber,
          account_name: result.data?.destinationAccountName,
          bank: result.data?.destinationBankName,
          monnify_ref: result.data?.transactionReference,
        },
      };
    } catch (error) {
      console.error("getTransferStatus error:", error.message);
      throw error;
    }
  }

  //GET /wallet/receive — returns account details + QR code
  async getReceiveFundsDetails() {
    try {
      const wallet = await knex("wallets")
        .where({
          user_id: this.user.id,
          wallet_type: "FIAT",
          currency_code: "NGN",
          is_deleted: false,
        })
        .first();

      console.log(this.user.id);

      if (!wallet) {
        return { success: false, status: 404, message: "Wallet not found" };
      }

      if (!wallet.account_number) {
        return {
          success: false,
          status: 400,
          message:
            "Virtual account not yet activated. Please complete KYC first.",
        };
      }

      // Data to encode in QR
      const qrData = JSON.stringify({
        account_name: `${this.user.first_name} ${this.user.last_name}`,
        account_number: wallet.account_number,
        bank_name: wallet.bank_name || "Alleana Wallet",
      });

      // Generate QR code as base64 image
      const qrCodeBase64 = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });

      return {
        success: true,
        status: 200,
        message: "Account details retrieved successfully",
        data: {
          account_name: `${this.user.first_name} ${this.user.last_name}`,
          account_number: wallet.account_number,
          bank_name: wallet.bank_name || "Alleana Wallet",
          qr_code: qrCodeBase64,
        },
      };
    } catch (error) {
      console.error("getReceiveFundsDetails error:", error.message);
      throw error;
    }
  }

  async addPin(pin) {
    // 1. Verify user status (Matches your logic)
    if (this.user.status !== "active") {
      return {
        success: false,
        message: "User status is not active",
        status: 400,
      };
    }

    // 2. Perform Update with .returning() instead of .first()
    // This is where the 500 error was happening.
    const [updatedUser] = await knex("users")
      .where({ id: this.user.id })
      .update({
        pin: bcrypt.hashSync(String(pin), 10), // Use string to be safe
        updated_at: new Date(),
      })
      .returning(["phone_number", "last_name", "first_name", "email"]);

    // 3. Safety check if the user was actually found
    if (!updatedUser) {
      return {
        success: false,
        message: "User not found",
        status: 404,
      };
    }

    console.log("Updated user with new PIN:", updatedUser);

    return {
      success: true,
      status: 200,
      message: "Your PIN has been saved successfully.",
      data: updatedUser,
    };
  }

  async verifyTradebitAddress(address) {
    try {
      const wallet = await knex("wallets")
        // Combine first and last name as display_name
        .select(
          knex.raw(
            "users.first_name || ' ' || users.last_name as display_name",
          ),
          "wallets.wallet_address",
        )
        .innerJoin("users", "users.id", "wallets.user_id")
        .where("wallets.wallet_address", String(address))
        .first();

      if (!wallet) {
        return { success: false, status: 404, message: "Address not found" };
      }

      return {
        success: true,
        status: 200,
        data: {
          recipientName: wallet.display_name,
          address: wallet.wallet_address,
        },
      };
    } catch (err) {
      console.error("Database Query Error:", err);
      throw err;
    }
  }
  async getTradebitBalance() {
    const wallet = await knex("wallets")
      .where("user_id", this.user.id)
      .andWhere("currency_code", "TBT")
      .select("balance", "wallet_address")
      .first();

    return {
      success: true,
      status: 200,
      message: "Balance retrieved successfully",
      data: {
        balance: wallet?.balance || 0,
      },
    };
  }

  async transferTradebits(recipientAddress, amount, pin, isAnonymous) {
    const senderId = this.user.id;
    const user = await knex("users").where("id", senderId).first();

    if (!user) throw new Error("User not found");
    if (!user.pin)
      return {
        success: false,
        status: 400,
        message: "Transaction PIN not set.",
      };

    const pinValid = await bcrypt.compare(String(pin), user.pin);
    if (!pinValid)
      return {
        success: false,
        status: 401,
        message: "Invalid transaction PIN",
      };

    const amountNum = Number(amount);
    const tradebitFee = amountNum * 0.01;
    const totalDeduction = amountNum + tradebitFee;

    try {
      const result = await knex.transaction(async (trx) => {
        // 1. Fetch and Lock Wallets
        const senderWallet = await trx("wallets")
          .where({ user_id: senderId, wallet_type: "TRADEBITS" })
          .forUpdate()
          .first();

        if (!senderWallet || Number(senderWallet.balance) < totalDeduction) {
          throw new Error("Insufficient Tradebits balance");
        }

        const recipientWallet = await trx("wallets")
          .where("wallet_address", recipientAddress)
          .forUpdate()
          .first();

        if (!recipientWallet) throw new Error("Recipient address not found");

        // 2. Perform Balance Updates
        await trx("wallets")
          .where({ id: senderWallet.id })
          .decrement("balance", totalDeduction);
        await trx("wallets")
          .where({ id: recipientWallet.id })
          .increment("balance", amountNum);

        const reference = `TBT-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

        // 3. Record Main Transaction
        const [transaction] = await trx("transactions")
          .insert({
            sender_id: senderId,
            recipient_id: recipientWallet.user_id,
            recipient_address: recipientAddress,
            amount: amountNum,
            fee: tradebitFee,
            type: "TRANSFER", // Matches your 'type' column
            is_anonymous: !!isAnonymous,
            gifting_status: isAnonymous ? "Anonymous" : "Public",
            reference,
            status: "completed",
          })
          .returning("*");

        // 4. Record Ledger Entries
        await trx("ledger_entries").insert([
          {
            transaction_id: transaction.id,
            wallet_id: senderWallet.id,
            entry_type: "DEBIT",
            amount: totalDeduction,
            balance_before: senderWallet.balance,
            balance_after: Number(senderWallet.balance) - totalDeduction,
            reference: reference,
          },
          {
            transaction_id: transaction.id,
            wallet_id: recipientWallet.id,
            entry_type: "CREDIT",
            amount: amountNum,
            balance_before: recipientWallet.balance,
            balance_after: Number(recipientWallet.balance) + amountNum,
            reference: reference,
          },
        ]);

        return transaction;
      });

      return {
        success: true,
        status: 200,
        message: "Transfer successful",
        data: result,
      };
    } catch (err) {
      console.error("Transfer Error:", err.message);
      return { success: false, status: 400, message: err.message };
    }
  }

  async previewTradebitsFee(amount) {
    const NAIRA_PER_TRADEBIT = 5; // your exchange rate
    const FEE_PERCENT = 0.01;

    const nairaValue = amount * NAIRA_PER_TRADEBIT;
    const nairaFee = nairaValue * FEE_PERCENT; // ₦100 for 20 tradebits at ₦500 each

    return {
      amount,
      nairaFee,
      message: `You will be charged ₦${nairaFee.toFixed(2)} for this transaction.`,
    };
  }

  async tradebitTransaction(reference) {
    const userId = this.user.id; // Access the ID from the class context

    const tx = await knex("transactions")
      .where("reference", reference)
      .andWhere(function () {
        // Security: Only the sender OR the recipient can view this data
        this.where("sender_id", userId).orWhere("recipient_id", userId);
      })
      .first();

    if (!tx) {
      return {
        success: false,
        status: 404,
        message:
          "Transaction not found or you do not have permission to view it.",
      };
    }

    // Check if current user is the sender to decide on Fee display
    const isSender = tx.sender_id === userId;

    return {
      success: true,
      data: {
        amount: tx.amount,
        // Design shows fee—usually only relevant to the sender
        fee: isSender ? `₦${Number(tx.fee).toFixed(2)}` : "₦0.00",
        paymentMethod: tx.payment_method || "Wallet Balance",
        giftingStatus:
          tx.gifting_status || (tx.is_anonymous ? "Anonymous" : "Public"),
        transactionId: tx.id, // Internal DB ID
        date: new Intl.DateTimeFormat("en-NG", {
          hour: "numeric",
          minute: "2-digit",
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(tx.created_at)),
      },
    };
  }

  async getTradebitHistory() {
  try {
    const userId = this.user.id;

    const history = await knex("transactions")
      .where(function() {
        this.where("sender_id", userId).orWhere("recipient_id", userId);
      })
      .orderBy("created_at", "desc") // Latest transactions at the top
      .select("*");

    // Format the list for the UI labels
    const formattedHistory = history.map(tx => {
      const isCredit = tx.recipient_id === userId;
      
      return {
        id: tx.id,
        reference: tx.reference,
        // Match Figma labels: "Buy Tradebits" or "Transferred Tradebits"
        title: tx.type === "BUY" ? "Buy Tradebits" : "Transferred Tradebits",
        amount: `${isCredit ? '+' : '-'} ${tx.amount} coins`,
        color: isCredit ? "green" : "red", // For the frontend +/- styling
        date: new Intl.DateTimeFormat("en-NG", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        }).format(new Date(tx.created_at))
      };
    });

    return { success: true, status: 200, data: formattedHistory };
  } catch (err) {
    return { success: false, status: 500, message: "Failed to fetch history" };
  }
}
}

module.exports = WalletService;
