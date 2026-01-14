# Wallet Integration Guide - Aileana Backend

**Version:** 2.0  
**Last Updated:** January 14, 2026  
**Database:** PostgreSQL (via Prisma)  
**Status:** ⚠️ Migration in Progress - Legacy MongoDB wallet deprecated

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Service Layer](#service-layer)
4. [Integration Guide](#integration-guide)
5. [API Endpoints](#api-endpoints)
6. [Webhook Integration](#webhook-integration)
7. [Security & Encryption](#security--encryption)
8. [Migration from Legacy](#migration-from-legacy)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Current State (Dual Architecture - Transitioning)

```
┌─────────────────────────────────────────────────────────────┐
│                    LEGACY (DEPRECATED)                       │
│  MongoDB → models/Wallet.js → controllers/walletController   │
│  Status: ❌ DO NOT USE - Being phased out                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    MODERN (ACTIVE)                           │
│  PostgreSQL → Prisma → wallet/services/* → Controllers       │
│  Status: ✅ USE THIS - Production Ready                     │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
wallet/
├── services/
│   ├── wallet.service.js      # Core wallet operations
│   ├── transaction.service.js # Transaction management
│   └── ledger.service.js      # Double-entry ledger system
├── controllers/
│   └── webhook.controller.js  # Monnify webhook handler
└── routes/
    └── webhook.route.js       # Webhook endpoints
```

---

## Database Schema

### Prisma Models (prisma/schema.prisma)

#### 1. Wallet Model

```prisma
model Wallet {
  id                  String        @id @default(cuid())
  userId              String        @unique
  walletAddress       String        @unique
  walletAddressName   String
  walletBankCode      String?
  walletBankName      String?
  currency            String        @default("NGN")
  balance             String        // Encrypted AES-256-GCM
  status              WalletStatus  @default(Active)
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
  transactions        Transaction[]
  ledgers             Ledger[]
}

enum WalletStatus {
  Active
  Inactive
  Suspended
}
```

#### 2. Transaction Model

```prisma
model Transaction {
  id              String            @id @default(cuid())
  walletId        String
  wallet          Wallet            @relation(fields: [walletId], references: [id])
  type            TransactionType
  flow            TransactionFlow
  status          TransactionStatus @default(Pending)
  amount          Float
  fees            Float             @default(0)
  totalAmount     Float
  currency        String            @default("NGN")
  reference       String            @unique
  description     String?
  metadata        Json?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  ledgers         Ledger[]
}

enum TransactionType {
  Deposit
  Withdrawal
  Transfer
  Payment
  Refund
}

enum TransactionFlow {
  Debit
  Credit
}

enum TransactionStatus {
  Pending
  Successful
  Reversed
  Failed
}
```

#### 3. Ledger Model

```prisma
model Ledger {
  id              String      @id @default(cuid())
  walletId        String
  wallet          Wallet      @relation(fields: [walletId], references: [id])
  transactionId   String
  transaction     Transaction @relation(fields: [transactionId], references: [id])
  debit           Float       @default(0)
  credit          Float       @default(0)
  prevBalance     Float
  currBalance     Float
  description     String?
  createdAt       DateTime    @default(now())
}
```

**Key Features:**

- **Encrypted Balances**: All wallet balances stored encrypted
- **Double-Entry Ledger**: Complete audit trail for all transactions
- **ACID Compliance**: Prisma transactions with row-level locking
- **Unique References**: Prevents duplicate transaction processing

---

## Service Layer

### 1. WalletService (`wallet/services/wallet.service.js`)

#### Core Methods

##### `createWallet(userId, currency = "NGN")`

Creates a new wallet with Monnify virtual account integration.

**Parameters:**

- `userId` (string): MongoDB User.\_id
- `currency` (string): Default "NGN"

**Returns:** Wallet object with virtual account details

**Example:**

```javascript
const walletService = require("./wallet/services/wallet.service")

const wallet = await walletService.createWallet(user._id, "NGN")
// Returns:
// {
//   id: "clxxx...",
//   userId: "507f1f77bcf86cd799439011",
//   walletAddress: "7814567890",
//   walletAddressName: "Aileana/John Doe",
//   walletBankCode: "035",
//   walletBankName: "Wema Bank",
//   balance: "encrypted_string",
//   status: "Active"
// }
```

**Integration with Monnify:**

```javascript
// Internal flow:
1. Validate user exists
2. Check for existing wallet
3. Call monnifyService.createVirtualAccount(user)
4. Create Prisma wallet record with encrypted balance (0.00)
5. Return wallet object
```

---

##### `creditWallet(walletId, amount, transactionData, fees = 0)`

Credits wallet with ACID transaction guarantees.

**Parameters:**

- `walletId` (string): Wallet ID
- `amount` (number): Amount to credit
- `transactionData` (object):
  ```javascript
  {
    type: "Deposit" | "Refund",
    reference: "unique_ref",
    description: "Optional description",
    metadata: { ... } // Optional JSON data
  }
  ```
- `fees` (number): Transaction fees (default: 0)

**Returns:** Transaction object

**Example:**

```javascript
const transaction = await walletService.creditWallet(
	wallet.id,
	5000,
	{
		type: "Deposit",
		reference: `DEP_${Date.now()}`,
		description: "Wallet funding via bank transfer",
		metadata: {
			paymentMethod: "bank_transfer",
			gateway: "monnify",
		},
	},
	25, // Fees
)

// User receives: 5000 - 25 = 4975 NGN
```

**Transaction Flow:**

```
BEGIN PRISMA TRANSACTION (15s timeout)
│
├─ 1. Lock wallet row (SELECT FOR UPDATE)
├─ 2. Validate ledger consistency
├─ 3. Create transaction record (status: Pending)
├─ 4. Decrypt current balance
├─ 5. Calculate: newBalance = current + (amount - fees)
├─ 6. Encrypt and update wallet balance
├─ 7. Create ledger entry (credit: amount, debit: fees)
├─ 8. Validate ledger consistency again
├─ 9. Update transaction status: Successful
│
COMMIT
```

**Error Handling:**

- Throws if wallet not found
- Throws if ledger inconsistency detected
- Auto-rollback on any failure
- Transaction timeout after 15 seconds

---

##### `debitWallet(walletId, amount, transactionData, fees = 0)`

Debits wallet with balance validation.

**Parameters:** Same as creditWallet

**Returns:** Transaction object

**Example:**

```javascript
const transaction = await walletService.debitWallet(
	wallet.id,
	1000,
	{
		type: "Withdrawal",
		reference: `WTH_${Date.now()}`,
		description: "Bank withdrawal",
	},
	50, // Fees
)

// User pays: 1000 + 50 = 1050 NGN total
```

**Important:** Throws error if insufficient balance

---

##### `getBalance(walletId)`

Retrieves decrypted wallet balance.

**Parameters:**

- `walletId` (string): Wallet ID

**Returns:** Number (decrypted balance)

**Example:**

```javascript
const balance = await walletService.getBalance(wallet.id)
console.log(balance) // 4975.00
```

---

##### `getWalletByUserId(userId)`

Finds wallet by MongoDB user ID.

**Parameters:**

- `userId` (string): MongoDB User.\_id

**Returns:** Wallet object or null

**Example:**

```javascript
const wallet = await walletService.getWalletByUserId(user._id)
if (!wallet) {
	// Create new wallet
	await walletService.createWallet(user._id)
}
```

---

##### `updateWalletStatus(walletId, status)`

Updates wallet status (Active/Inactive/Suspended).

**Parameters:**

- `walletId` (string)
- `status` (string): "Active" | "Inactive" | "Suspended"

**Example:**

```javascript
await walletService.updateWalletStatus(wallet.id, "Suspended")
// Prevents all wallet operations
```

---

### 2. TransactionService (`wallet/services/transaction.service.js`)

#### Methods

##### `createTransaction(transactionData)`

Creates transaction record.

**Parameters:**

```javascript
{
  walletId: "wallet_id",
  type: "Deposit" | "Withdrawal" | "Transfer" | "Payment" | "Refund",
  flow: "Credit" | "Debit",
  amount: 5000,
  fees: 25,
  reference: "unique_reference",
  description: "Optional",
  metadata: { key: "value" }
}
```

**Auto-calculations:**

- Credit: `totalAmount = amount - fees`
- Debit: `totalAmount = amount + fees`

---

##### `getTransactionsByWalletId(walletId, options)`

Retrieves wallet transactions with pagination.

**Parameters:**

- `walletId` (string)
- `options` (object):
  ```javascript
  {
    skip: 0,
    take: 20,
    orderBy: { createdAt: "desc" },
    where: { status: "Successful" } // Additional filters
  }
  ```

**Example:**

```javascript
const transactions = await transactionService.getTransactionsByWalletId(wallet.id, { skip: 0, take: 10 })
```

---

### 3. LedgerService (`wallet/services/ledger.service.js`)

#### Methods

##### `createLedgerEntry(ledgerData)`

Creates double-entry ledger record.

**Parameters:**

```javascript
{
  walletId: "wallet_id",
  transactionId: "txn_id",
  debit: 0,
  credit: 5000,
  prevBalance: 1000,
  currBalance: 6000,
  description: "Wallet credited"
}
```

---

##### `validateLedgerInflowOutflowConsistency(walletId)`

**Critical Security Method** - Validates ledger integrity.

**Logic:**

```javascript
SUM(credits) - SUM(debits) === current_wallet_balance
```

**Returns:** `true` if consistent, `false` if corrupted

**Usage:**

```javascript
const isValid = await ledgerService.validateLedgerInflowOutflowConsistency(wallet.id)
if (!isValid) {
	throw new Error("Ledger inconsistency detected - manual intervention required")
}
```

**When It Runs:**

- Before every credit/debit operation
- After every credit/debit operation
- Prevents financial discrepancies

---

## Integration Guide

### 1. User Registration Flow

**File:** `controllers/authController.js`

```javascript
const walletService = require("./wallet/services/wallet.service")

// ❌ DEPRECATED - Remove this
const Wallet = require("./models/Wallet") // MongoDB model

exports.signup = async (req, res) => {
	try {
		const { firstName, lastName, email, password } = req.body

		// Create user in MongoDB
		const user = new User({ firstName, lastName, email, password })
		const hashedPassword = await bcrypt.hash(password, 10)
		user.password = hashedPassword
		const newUser = await user.save()

		// ✅ NEW - Create PostgreSQL wallet
		const wallet = await walletService.createWallet(newUser._id, "NGN")

		res.status(201).json({
			message: "User created successfully",
			user: {
				id: newUser._id,
				email: newUser.email,
				wallet: {
					walletAddress: wallet.walletAddress,
					bankName: wallet.walletBankName,
					bankCode: wallet.walletBankCode,
				},
			},
		})
	} catch (error) {
		console.error(error)
		res.status(500).json({ message: "Error creating user" })
	}
}
```

---

### 2. User Login Flow

**File:** `controllers/authController.js`

**Current Issue (Line 152):**

```javascript
// ❌ DEPRECATED - Checking MongoDB wallet
let wallet = await Wallet.findOne({ user: user._id })
if (!wallet) {
	wallet = new Wallet({
		user: user._id,
		nairaBalance: 0,
		// ...
	})
	await wallet.save()
}
```

**✅ Correct Implementation:**

```javascript
const walletService = require("./wallet/services/wallet.service")

exports.login = async (req, res) => {
	try {
		const { email, password } = req.body

		// Authenticate user
		const user = await User.findOne({ email })
		if (!user) {
			return res.status(401).json({ message: "Invalid credentials" })
		}

		const isPasswordValid = await bcrypt.compare(password, user.password)
		if (!isPasswordValid) {
			return res.status(401).json({ message: "Invalid credentials" })
		}

		// Get or create Prisma wallet
		let wallet = await walletService.getWalletByUserId(user._id)
		if (!wallet) {
			wallet = await walletService.createWallet(user._id, "NGN")
		}

		// Get decrypted balance
		const balance = await walletService.getBalance(wallet.id)

		// Generate JWT
		const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" })

		res.json({
			message: "Login successful",
			token,
			user: {
				id: user._id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
			},
			wallet: {
				walletAddress: wallet.walletAddress,
				bankName: wallet.walletBankName,
				bankCode: wallet.walletBankCode,
				balance: balance,
				currency: wallet.currency,
			},
		})
	} catch (error) {
		console.error(error)
		res.status(500).json({ message: "Login failed" })
	}
}
```

---

### 3. Creating New Wallet Endpoints

**File:** `routes/wallet.js` (Needs Complete Refactor)

**Current Status:** All endpoints use deprecated MongoDB wallet

**✅ New Implementation:**

```javascript
const express = require("express")
const router = express.Router()
const { authenticateToken } = require("../middleware/auth")
const walletService = require("../wallet/services/wallet.service")
const transactionService = require("../wallet/services/transaction.service")
const { logActivity } = require("../utils/activityLogger")

// Get wallet details
router.get("/wallet", authenticateToken, async (req, res) => {
	try {
		const wallet = await walletService.getWalletByUserId(req.user.userId)

		if (!wallet) {
			return res.status(404).json({ message: "Wallet not found" })
		}

		const balance = await walletService.getBalance(wallet.id)

		res.json({
			wallet: {
				id: wallet.id,
				walletAddress: wallet.walletAddress,
				bankName: wallet.walletBankName,
				bankCode: wallet.walletBankCode,
				balance: balance,
				currency: wallet.currency,
				status: wallet.status,
			},
		})
	} catch (error) {
		console.error(error)
		res.status(500).json({ message: "Error fetching wallet" })
	}
})

// Get transaction history
router.get("/wallet/transactions", authenticateToken, async (req, res) => {
	try {
		const { page = 1, limit = 20 } = req.query
		const wallet = await walletService.getWalletByUserId(req.user.userId)

		if (!wallet) {
			return res.status(404).json({ message: "Wallet not found" })
		}

		const transactions = await transactionService.getTransactionsByWalletId(wallet.id, {
			skip: (page - 1) * limit,
			take: parseInt(limit),
			orderBy: { createdAt: "desc" },
		})

		res.json({ transactions })
	} catch (error) {
		console.error(error)
		res.status(500).json({ message: "Error fetching transactions" })
	}
})

// Initiate withdrawal (example)
router.post("/wallet/withdraw", authenticateToken, async (req, res) => {
	try {
		const { amount, bankAccount } = req.body
		const wallet = await walletService.getWalletByUserId(req.user.userId)

		if (!wallet) {
			return res.status(404).json({ message: "Wallet not found" })
		}

		// Check balance
		const balance = await walletService.getBalance(wallet.id)
		const withdrawalFee = 50 // Example fee
		const totalAmount = amount + withdrawalFee

		if (balance < totalAmount) {
			return res.status(400).json({ message: "Insufficient balance" })
		}

		// Create debit transaction
		const transaction = await walletService.debitWallet(
			wallet.id,
			amount,
			{
				type: "Withdrawal",
				reference: `WTH_${Date.now()}_${req.user.userId}`,
				description: `Withdrawal to ${bankAccount.accountNumber}`,
				metadata: { bankAccount },
			},
			withdrawalFee,
		)

		// Log activity
		await logActivity({
			userId: req.user.userId,
			action: "wallet_withdrawal",
			description: `Withdrawal of NGN${amount} initiated`,
			req,
			event: "Withdrawal",
		})

		// TODO: Integrate with payment provider to process withdrawal

		res.json({
			message: "Withdrawal initiated",
			transaction: {
				id: transaction.id,
				amount: transaction.amount,
				fees: transaction.fees,
				totalAmount: transaction.totalAmount,
				status: transaction.status,
				reference: transaction.reference,
			},
		})
	} catch (error) {
		console.error(error)
		res.status(500).json({ message: "Withdrawal failed" })
	}
})

module.exports = router
```

---

## API Endpoints

### Current Endpoints (To Be Refactored)

| Method | Endpoint               | Status        | Action Required                |
| ------ | ---------------------- | ------------- | ------------------------------ |
| POST   | `/api/wallet/create`   | ❌ Deprecated | Remove - Auto-create on signup |
| GET    | `/api/wallet/balance`  | ❌ Deprecated | Replace with `GET /api/wallet` |
| POST   | `/api/wallet/deposit`  | ❌ Deprecated | Remove - Use webhook           |
| POST   | `/api/wallet/withdraw` | ❌ Deprecated | Refactor to use walletService  |

### New Recommended Endpoints

| Method | Endpoint                      | Description                         |
| ------ | ----------------------------- | ----------------------------------- |
| GET    | `/api/wallet`                 | Get wallet details & balance        |
| GET    | `/api/wallet/transactions`    | Get transaction history (paginated) |
| POST   | `/api/wallet/withdraw`        | Initiate withdrawal                 |
| POST   | `/api/wallet/transfer`        | Transfer to another user            |
| GET    | `/api/wallet/transaction/:id` | Get transaction details             |

### Active Webhook Endpoint

| Method | Endpoint       | Description                                |
| ------ | -------------- | ------------------------------------------ |
| POST   | `/api/webhook` | Monnify payment webhook (handles deposits) |

---

## Webhook Integration

### Monnify Webhook Handler

**File:** `wallet/controllers/webhook.controller.js`

**Endpoint:** `POST /api/webhook`

**Purpose:** Automatically credit user wallet when payment is received

**Flow:**

```
User transfers money to virtual account
        ↓
Monnify processes payment
        ↓
Monnify sends webhook to /api/webhook
        ↓
Verify HMAC-SHA512 signature
        ↓
Extract userId from product.reference ("AILEANA_{userId}")
        ↓
Find user wallet by userId
        ↓
Check for duplicate transaction (by reference)
        ↓
Credit wallet with settlementAmount
        ↓
Log activity
        ↓
Return 200 OK
```

**Security:**

1. **HMAC-SHA512 Signature Verification:**

```javascript
const computedHash = crypto.createHmac("sha512", MONNIFY_SECRET_KEY).update(JSON.stringify(req.body)).digest("hex")

if (computedHash !== req.headers["monnify-signature"]) {
	return res.status(401).json({ message: "Invalid signature" })
}
```

2. **Idempotency:** Prevents duplicate processing

```javascript
const existingTransaction = await prisma.transaction.findFirst({
	where: { reference: transactionReference },
})
if (existingTransaction) {
	return res.status(200).json({ message: "Already processed" })
}
```

**Webhook Payload Example:**

```json
{
	"eventType": "SUCCESSFUL_TRANSACTION",
	"eventData": {
		"transactionReference": "MNFY|20|20240114120000|000123",
		"paymentReference": "AILEANA_507f1f77bcf86cd799439011",
		"amountPaid": "5000.00",
		"totalPayable": "5000.00",
		"settlementAmount": "4975.00",
		"paidOn": "2024-01-14 12:00:00",
		"paymentStatus": "PAID",
		"product": {
			"reference": "AILEANA_507f1f77bcf86cd799439011",
			"type": "RESERVED_ACCOUNT"
		}
	}
}
```

**Testing Webhook Locally:**

```bash
# Use ngrok to expose local server
ngrok http 3000

# Update Monnify webhook URL in dashboard
https://your-ngrok-url.ngrok.io/api/webhook
```

---

## Security & Encryption

### Balance Encryption

**Algorithm:** AES-256-GCM  
**File:** `utils/encrypter.js`

**How It Works:**

```javascript
// Encryption
const balance = 5000.5
const encryptedBalance = encrypt(balance.toString())
// Stores: "iv:authTag:encryptedData"

// Decryption
const decryptedBalance = parseFloat(decrypt(wallet.balance))
// Returns: 5000.50
```

**Key Benefits:**

- Database compromise doesn't expose balances
- Requires encryption key to decrypt
- Auth tag ensures data integrity

**Environment Variables Required:**

```env
ENCRYPTION_KEY=your-32-byte-hex-key
```

**Generate Key:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Transaction Security

1. **Row-Level Locking:**

```javascript
const wallet = await prisma.wallet.findUnique({
	where: { id: walletId },
	// Locks row until transaction completes
	include: { ledgers: true },
})
```

2. **Transaction Timeout:** 15 seconds max

```javascript
await prisma.$transaction(
	async (tx) => {
		// All operations here
	},
	{
		maxWait: 5000,
		timeout: 15000,
	},
)
```

3. **Unique References:** Prevents duplicate processing

```prisma
reference String @unique
```

4. **Ledger Validation:** Before & after every operation

```javascript
const isValid = await ledgerService.validateLedgerInflowOutflowConsistency(walletId)
```

---

## Migration from Legacy

### Step 1: Data Migration Script

Create `scripts/migrate-wallets.js`:

```javascript
const mongoose = require("mongoose")
const { PrismaClient } = require("@prisma/client")
const WalletLegacy = require("./models/Wallet") // MongoDB model
const walletService = require("./wallet/services/wallet.service")

const prisma = new PrismaClient()

async function migrateWallets() {
	try {
		// Connect to MongoDB
		await mongoose.connect(process.env.MONGODB_URI)

		// Get all legacy wallets
		const legacyWallets = await WalletLegacy.find({})
		console.log(`Found ${legacyWallets.length} legacy wallets`)

		for (const legacyWallet of legacyWallets) {
			try {
				// Check if Prisma wallet already exists
				const existingWallet = await walletService.getWalletByUserId(legacyWallet.user.toString())

				if (existingWallet) {
					console.log(`Wallet exists for user ${legacyWallet.user}`)
					continue
				}

				// Create new Prisma wallet
				const newWallet = await walletService.createWallet(legacyWallet.user.toString(), "NGN")

				// Migrate balance if exists
				const legacyBalance = legacyWallet.nairaBalance || 0
				if (legacyBalance > 0) {
					await walletService.creditWallet(newWallet.id, legacyBalance, {
						type: "Deposit",
						reference: `MIGRATION_${legacyWallet._id}`,
						description: "Balance migrated from legacy system",
					})
				}

				console.log(`✅ Migrated wallet for user ${legacyWallet.user}`)
			} catch (error) {
				console.error(`❌ Error migrating wallet ${legacyWallet._id}:`, error.message)
			}
		}

		console.log("Migration completed!")
	} catch (error) {
		console.error("Migration failed:", error)
	} finally {
		await mongoose.disconnect()
		await prisma.$disconnect()
	}
}

migrateWallets()
```

**Run Migration:**

```bash
node scripts/migrate-wallets.js
```

---

### Step 2: Update Controllers

Replace all MongoDB wallet imports:

```javascript
// ❌ Remove
const Wallet = require("./models/Wallet")
const Transaction = require("./models/Transaction")

// ✅ Add
const walletService = require("./wallet/services/wallet.service")
const transactionService = require("./wallet/services/transaction.service")
```

---

### Step 3: Update Routes

**File:** `server.js`

```javascript
// ❌ Remove or refactor
const walletRoutes = require("./routes/wallet") // Uses MongoDB

// ✅ Keep (already using Prisma)
const webhookRoute = require("./wallet/routes/webhook.route")

// ✅ Add new wallet routes
const walletRoutesV2 = require("./routes/wallet-v2") // New Prisma-based routes

app.use("/api", webhookRoute)
app.use("/api", walletRoutesV2)
```

---

### Step 4: Delete Legacy Files

After migration is complete and verified:

```bash
# Backup first!
mkdir legacy-backup
cp models/Wallet.js legacy-backup/
cp models/Transaction.js legacy-backup/
cp controllers/walletController.js legacy-backup/
cp routes/wallet.js legacy-backup/

# Then remove
rm models/Wallet.js
rm models/Transaction.js
rm controllers/walletController.js
# routes/wallet.js - Refactor instead of deleting
```

---

## Best Practices

### 1. Always Use Services, Never Direct Prisma Calls

❌ **Bad:**

```javascript
const wallet = await prisma.wallet.update({
	where: { id: walletId },
	data: { balance: newBalance },
})
```

✅ **Good:**

```javascript
const transaction = await walletService.creditWallet(walletId, amount, transactionData)
```

**Why:** Services handle encryption, ledger validation, and ACID guarantees.

---

### 2. Always Include Unique References

```javascript
// Generate unique reference
const reference = `${type.toUpperCase()}_${Date.now()}_${userId}`

await walletService.creditWallet(wallet.id, amount, {
	type: "Deposit",
	reference: reference, // Required
	description: "Payment description",
})
```

---

### 3. Handle Errors Gracefully

```javascript
try {
  const transaction = await walletService.debitWallet(...);
} catch (error) {
  if (error.message.includes("Insufficient balance")) {
    return res.status(400).json({ message: "Insufficient funds" });
  }
  if (error.message.includes("Ledger inconsistency")) {
    // Critical error - notify admin
    console.error("CRITICAL: Ledger corruption detected", error);
    return res.status(500).json({ message: "System error - contact support" });
  }
  // Generic error
  return res.status(500).json({ message: "Transaction failed" });
}
```

---

### 4. Log All Wallet Operations

```javascript
const { logActivity } = require("./utils/activityLogger");

await walletService.creditWallet(...);

await logActivity({
  userId: user._id,
  action: "wallet_credited",
  description: `Wallet credited with NGN${amount}`,
  req,
  event: "WalletCredit"
});
```

---

### 5. Never Store Decrypted Balance

❌ **Bad:**

```javascript
const balance = await walletService.getBalance(wallet.id)
wallet.decryptedBalance = balance // Don't store in memory
await wallet.save()
```

✅ **Good:**

```javascript
// Decrypt only when needed for display
const balance = await walletService.getBalance(wallet.id)
res.json({ balance }) // Send immediately
// Balance not stored anywhere
```

---

### 6. Use Pagination for Transactions

```javascript
router.get("/wallet/transactions", async (req, res) => {
	const { page = 1, limit = 20 } = req.query

	const transactions = await transactionService.getTransactionsByWalletId(wallet.id, {
		skip: (page - 1) * limit,
		take: Math.min(limit, 100), // Max 100 per page
		orderBy: { createdAt: "desc" },
	})

	res.json({ page, limit, transactions })
})
```

---

## Troubleshooting

### Issue 1: "Ledger inconsistency detected"

**Cause:** SUM(credits) - SUM(debits) ≠ wallet balance

**Solution:**

```javascript
// Check ledger
const ledgerService = require("./wallet/services/ledger.service")
const isValid = await ledgerService.validateLedgerInflowOutflowConsistency(walletId)

if (!isValid) {
	// Manual intervention required
	// 1. Lock wallet
	await walletService.updateWalletStatus(walletId, "Suspended")

	// 2. Audit ledger entries
	const ledgers = await prisma.ledger.findMany({
		where: { walletId },
		orderBy: { createdAt: "asc" },
	})

	// 3. Recalculate balance manually
	let calculatedBalance = 0
	for (const ledger of ledgers) {
		calculatedBalance += ledger.credit - ledger.debit
	}

	console.log("Calculated balance:", calculatedBalance)
	console.log("Current balance:", await walletService.getBalance(walletId))

	// 4. Contact admin for reconciliation
}
```

---

### Issue 2: "Wallet not found" after login

**Cause:** User registered before Prisma wallet integration

**Solution:**

```javascript
// Auto-create wallet if missing
let wallet = await walletService.getWalletByUserId(user._id)
if (!wallet) {
	wallet = await walletService.createWallet(user._id, "NGN")
}
```

---

### Issue 3: Webhook not receiving payments

**Checklist:**

1. ✅ Verify Monnify webhook URL configured correctly
2. ✅ Check webhook endpoint is publicly accessible
3. ✅ Verify HMAC signature validation
4. ✅ Check `product.reference` format: `AILEANA_{userId}`
5. ✅ Ensure raw body parser for webhook route

**Debug:**

```javascript
// Add logging to webhook controller
console.log("Webhook headers:", req.headers)
console.log("Webhook body:", req.body)
console.log("Signature:", req.headers["monnify-signature"])
```

---

### Issue 4: Duplicate transaction processing

**Cause:** Webhook retries without idempotency check

**Solution:** Already implemented in webhook controller

```javascript
const existingTransaction = await prisma.transaction.findFirst({
	where: { reference: transactionReference },
})

if (existingTransaction) {
	return res.status(200).json({ message: "Already processed" })
}
```

---

### Issue 5: Encryption errors

**Cause:** Missing or invalid `ENCRYPTION_KEY`

**Solution:**

```bash
# Generate new key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env
ENCRYPTION_KEY=your_generated_key_here
```

**Note:** Changing encryption key will invalidate all existing encrypted balances!

---

## Environment Variables

Required `.env` variables for wallet system:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/aileana"
MONGODB_URI="mongodb://localhost:27017/aileana"

# Encryption
ENCRYPTION_KEY="your-32-byte-hex-key"

# Monnify Integration
MONNIFY_API_KEY="your_api_key"
MONNIFY_SECRET_KEY="your_secret_key"
MONNIFY_BASE_URL="https://sandbox.monnify.com" # or production URL
MONNIFY_CONTRACT_CODE="your_contract_code"

# JWT
JWT_SECRET="your_jwt_secret"
```

---

## Testing

### Unit Test Example

```javascript
// tests/wallet.service.test.js
const walletService = require("../wallet/services/wallet.service")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

describe("WalletService", () => {
	let testWallet

	beforeAll(async () => {
		// Create test wallet
		testWallet = await walletService.createWallet("test_user_id", "NGN")
	})

	afterAll(async () => {
		// Cleanup
		await prisma.wallet.delete({ where: { id: testWallet.id } })
		await prisma.$disconnect()
	})

	it("should credit wallet successfully", async () => {
		const transaction = await walletService.creditWallet(testWallet.id, 1000, {
			type: "Deposit",
			reference: `TEST_${Date.now()}`,
			description: "Test deposit",
		})

		expect(transaction.status).toBe("Successful")
		expect(transaction.amount).toBe(1000)

		const balance = await walletService.getBalance(testWallet.id)
		expect(balance).toBe(1000)
	})

	it("should debit wallet with sufficient balance", async () => {
		const transaction = await walletService.debitWallet(testWallet.id, 500, {
			type: "Withdrawal",
			reference: `TEST_WTH_${Date.now()}`,
			description: "Test withdrawal",
		})

		expect(transaction.status).toBe("Successful")
		const balance = await walletService.getBalance(testWallet.id)
		expect(balance).toBe(500)
	})

	it("should throw error on insufficient balance", async () => {
		await expect(
			walletService.debitWallet(testWallet.id, 10000, {
				type: "Withdrawal",
				reference: `TEST_FAIL_${Date.now()}`,
			}),
		).rejects.toThrow("Insufficient balance")
	})
})
```

---

## Summary

### ✅ Use Modern Wallet System

- PostgreSQL/Prisma-based
- Located in `wallet/services/*`
- Encrypted balances
- Double-entry ledger
- ACID compliant

### ❌ Avoid Legacy System

- MongoDB-based
- `models/Wallet.js`, `models/Transaction.js`
- `controllers/walletController.js`
- `routes/wallet.js` (needs refactoring)

### 🔑 Key Integration Points

1. **Signup**: Auto-create wallet via `walletService.createWallet()`
2. **Login**: Fetch wallet and balance
3. **Deposits**: Handled via Monnify webhook
4. **Withdrawals/Transfers**: Use `walletService.debitWallet()`

### 🛡️ Security Checklist

- ✅ Always use service layer
- ✅ Generate unique references
- ✅ Validate ledger consistency
- ✅ Handle errors gracefully
- ✅ Log all operations
- ✅ Never store decrypted balances

---

## Support & Questions

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review service layer implementation in `wallet/services/*`
3. Check Prisma schema in `prisma/schema.prisma`
4. Review webhook implementation in `wallet/controllers/webhook.controller.js`

---

**Document Version:** 2.0  
**Last Updated:** January 14, 2026  
**Maintained By:** Development Team
