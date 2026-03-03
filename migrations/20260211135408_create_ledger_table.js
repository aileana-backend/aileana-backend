exports.up = function (knex) {
  return knex.schema.createTable("ledger_entries", function (table) {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    table.uuid("transaction_id").notNullable().index();
    table.uuid("wallet_id").notNullable().index();

    table.enu("entry_type", ["DEBIT", "CREDIT"]).notNullable();

    table.decimal("amount", 18, 2).notNullable();

    table.decimal("balance_before", 18, 2);
    table.decimal("balance_after", 18, 2);

    table.string("reference").notNullable().index();

    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("ledger_entries");
};
