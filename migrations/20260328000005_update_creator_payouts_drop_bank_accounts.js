exports.up = async function (knex) {
  // Drop the unused creator_bank_accounts table
  await knex.schema.dropTableIfExists("creator_bank_accounts");

  // Rebuild creator_payouts without bank_account_id foreign key —
  // store bank details inline (resolved via Monnify at withdraw time)
  await knex.schema.dropTableIfExists("creator_payouts");
  await knex.schema.createTable("creator_payouts", function (table) {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("creator_id").notNullable().index();
    table.decimal("amount", 14, 2).notNullable();

    // Bank details stored at time of withdrawal (from Monnify resolve)
    table.string("bank_name").notNullable();
    table.string("account_number").notNullable();
    table.string("account_name").notNullable();

    table
      .enu("status", ["pending", "processing", "completed", "failed"])
      .defaultTo("pending");
    table.string("reference").notNullable().unique();
    table.text("failure_reason").nullable();
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("creator_payouts");
  // Recreate original creator_payouts with bank_account_id
  await knex.schema.createTable("creator_payouts", function (table) {
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
