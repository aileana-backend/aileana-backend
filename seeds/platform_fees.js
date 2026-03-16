/**
 * Seed: platform_fees
 *
 * Populates the fee configuration based on the Aileana Platform Fee Summary document.
 * All amounts are in NGN.
 */
exports.seed = async function (knex) {
  // Wipe existing rows so the seed is idempotent
  await knex("platform_fees").del();

  await knex("platform_fees").insert([
    // ─── 1. Wallet & P2P Fees ─────────────────────────────────────────────────
    {
      fee_key: "p2p_small",
      category: "Wallet & P2P",
      description: "P2P transfer below ₦50,000",
      rate_type: "fixed",
      rate: 0,
      cap_amount: null,
      min_amount: 0,
      max_amount: 50000,
      is_active: true,
    },
    {
      fee_key: "p2p_large",
      category: "Wallet & P2P",
      description: "P2P transfer ₦50,000 and above (1.5% mid-point, capped)",
      rate_type: "percentage",
      rate: 1.5,          // Using 1.5% as the midpoint of 1–2%
      cap_amount: 10000,  // Recommended cap for high-value transfers
      min_amount: 50000,
      max_amount: null,
      is_active: true,
    },
    {
      fee_key: "wallet_withdrawal",
      category: "Wallet & P2P",
      description: "Wallet withdrawal for amounts ₦50,000+",
      rate_type: "fixed",
      rate: 50,           // ₦50 flat fee
      cap_amount: null,
      min_amount: 50000,
      max_amount: null,
      is_active: true,
    },

    // ─── 2. Marketplace Fees ──────────────────────────────────────────────────
    {
      fee_key: "product_sale",
      category: "Marketplace",
      description: "Product sales commission (5%)",
      rate_type: "percentage",
      rate: 5,
      cap_amount: 10000,  // Recommended cap per transaction for high-value items
      min_amount: null,
      max_amount: null,
      is_active: true,
    },
    {
      fee_key: "service_booking",
      category: "Marketplace",
      description: "Service bookings commission (7%)",
      rate_type: "percentage",
      rate: 7,
      cap_amount: null,
      min_amount: null,
      max_amount: null,
      is_active: true,
    },
    {
      fee_key: "freelancer_job",
      category: "Marketplace",
      description: "Freelancer jobs commission (10%)",
      rate_type: "percentage",
      rate: 10,
      cap_amount: null,
      min_amount: null,
      max_amount: null,
      is_active: true,
    },

    // ─── 3. Escrow & Transaction Safety Fees ──────────────────────────────────
    {
      fee_key: "escrow",
      category: "Escrow",
      description: "Escrow fee for products, services, or freelancer jobs (1%)",
      rate_type: "percentage",
      rate: 1,
      cap_amount: null,
      min_amount: null,
      max_amount: null,
      is_active: true,
    },

    // ─── 4. Social & Viral Commerce Fees ──────────────────────────────────────
    {
      fee_key: "boost_post",
      category: "Social & Viral",
      description: "Boosted product posts / promoted status updates (₦3,000–₦5,000 per boost)",
      rate_type: "fixed",
      rate: 3000,         // Minimum; UI can offer ₦3,000 or ₦5,000 tiers
      cap_amount: null,
      min_amount: null,
      max_amount: null,
      is_active: true,
    },
    {
      fee_key: "affiliate",
      category: "Social & Viral",
      description: "Affiliate / status sharing commission to user (2.5% mid-point)",
      rate_type: "percentage",
      rate: 2.5,          // Midpoint of 2–3%
      cap_amount: null,
      min_amount: null,
      max_amount: null,
      is_active: true,
    },
  ]);
};
