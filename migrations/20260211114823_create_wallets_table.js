exports.up = function (knex) {
  return knex.schema.createTable("wallets", function (table) {
    table.increments("id").primary();
    table.string("user_id").notNullable();
    table.string("currency_code").notNullable();
    table.string("wallet_address_name");
    table.string("wallet_type").notNullable();
    table.string("account_number");
    table.string("bank_name");
    table.string("account_reference");
    table.string("wallet_address");
    table.string("wallet_address_tag");
    table.decimal("balance", 14, 2).defaultTo(0);
    table.enu("status", ["active", "frozen", "disputed"]).defaultTo("active");
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("wallets");
};
