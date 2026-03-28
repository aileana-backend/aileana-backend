exports.up = function (knex) {
  return knex.schema.createTable("creator_bank_accounts", function (table) {
    table.increments("id").primary();
    table.string("user_id").notNullable().index();
    table.string("bank_name").notNullable();
    table.string("account_number").notNullable();
    table.string("account_name").notNullable();
    table.boolean("is_default").defaultTo(false);
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("creator_bank_accounts");
};
