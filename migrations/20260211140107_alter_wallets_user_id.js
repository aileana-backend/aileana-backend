exports.up = async function (knex) {
  await knex.schema.alterTable("wallets", function (table) {
    table.uuid("user_id").alter();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("wallets", function (table) {
    table.integer("user_id").alter();
  });
};
