exports.up = function (knex) {
  return knex.schema.createTable("creator_earnings", function (table) {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("creator_id").notNullable().index();

    table.decimal("amount", 14, 2).notNullable();
    table
      .enu("type", ["content_sale", "tip", "subscription", "invoice", "bonus"])
      .notNullable();
    table.string("source_id").nullable(); // post_id, invoice_id, etc.
    table.string("description").nullable();
    table
      .enu("status", ["available", "pending", "withdrawn"])
      .defaultTo("available");

    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("creator_earnings");
};
