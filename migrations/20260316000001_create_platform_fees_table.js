exports.up = function (knex) {
  return knex.schema.createTable("platform_fees", function (table) {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    // Unique key for looking up fees in code
    table.string("fee_key").notNullable().unique();

    // e.g. "Wallet & P2P", "Marketplace", "Escrow", "Social & Viral"
    table.string("category").notNullable();

    // e.g. "P2P Transfer >= ₦50,000", "Product Sale", "Escrow"
    table.string("description").notNullable();

    // "percentage" or "fixed"
    table.enu("rate_type", ["percentage", "fixed"]).notNullable();

    // The fee value: a percentage (e.g. 1.5) or a fixed NGN amount (e.g. 50)
    table.decimal("rate", 10, 4).notNullable().defaultTo(0);

    // Optional cap on percentage-based fees (in NGN)
    table.decimal("cap_amount", 18, 2).nullable();

    // Amount threshold: fee only applies when transaction amount >= min_amount
    table.decimal("min_amount", 18, 2).nullable();

    // Amount threshold: fee only applies when transaction amount < max_amount
    table.decimal("max_amount", 18, 2).nullable();

    table.boolean("is_active").defaultTo(true);

    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("platform_fees");
};
