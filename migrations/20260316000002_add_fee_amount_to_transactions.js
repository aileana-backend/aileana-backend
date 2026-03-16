exports.up = function (knex) {
  return knex.schema.table("transactions", function (table) {
    // The platform fee charged on this transaction
    table.decimal("fee_amount", 18, 2).defaultTo(0).after("amount");

    // The fee_key from platform_fees table (for traceability)
    table.string("fee_key").nullable().after("fee_amount");
  });
};

exports.down = function (knex) {
  return knex.schema.table("transactions", function (table) {
    table.dropColumn("fee_amount");
    table.dropColumn("fee_key");
  });
};
