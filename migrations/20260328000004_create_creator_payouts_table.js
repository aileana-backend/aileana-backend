exports.up = function (knex) {
  return knex.schema.createTable("creator_payouts", function (table) {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("creator_id").notNullable().index();
    table.decimal("amount", 14, 2).notNullable();
    table.integer("bank_account_id").notNullable();
    table
      .enu("status", ["pending", "processing", "completed", "failed"])
      .defaultTo("pending");
    table.string("reference").notNullable().unique();
    table.text("failure_reason").nullable();
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("creator_payouts");
};
