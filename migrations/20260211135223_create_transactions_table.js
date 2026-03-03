exports.up = function (knex) {
  return knex.schema.createTable("transactions", function (table) {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    table.uuid("user_id").notNullable().index();
    table.uuid("wallet_id").notNullable().index();

    table.string("transaction_type").notNullable(); // CREDIT, DEBIT, etc
    table.string("reference").notNullable().unique();

    table.decimal("amount", 18, 2).notNullable();
    table.decimal("balance_before", 18, 2);
    table.decimal("balance_after", 18, 2);

    table
      .enu("status", ["pending", "completed", "failed"])
      .defaultTo("pending");

    table.jsonb("metadata");
    table.string("description");

    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("transactions");
};
