exports.up = function (knex) {
  return knex.schema.createTable("vendor_products", function (table) {
    table
      .uuid("id")
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));

    table
      .uuid("store_id")
      .notNullable()
      .references("id")
      .inTable("stores")
      .onDelete("CASCADE");

    table.integer("user_id").notNullable();

    table.string("name").notNullable();
    table.string("category").notNullable();
    table.text("description").nullable();

    // Array of { url, public_id } objects
    table.jsonb("images").defaultTo("[]");

    table.decimal("price", 12, 2).notNullable();
    table.decimal("discount_price", 12, 2).nullable();

    // { sizes: [], colors: [] }
    table.jsonb("variants").defaultTo("{}");

    // { weight, unit, free_shipping, ship_from, processing_time, methods[] }
    table.jsonb("shipping").defaultTo("{}");

    table
      .enu("status", ["draft", "published", "deleted"])
      .defaultTo("draft")
      .notNullable();

    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("vendor_products");
};
