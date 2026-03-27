exports.up = function (knex) {
  return knex.schema.createTable("creator_verifications", function (table) {
    table.increments("id").primary();
    table.string("user_id").notNullable().unique();

    // Step 1: Content category
    table.specificType("content_categories", "text[]").nullable();

    // Step 2: Identity document
    table
      .enu("document_type", ["national_id", "passport", "drivers_license"])
      .nullable();
    table.string("front_image_url").nullable();
    table.string("back_image_url").nullable();

    // Step 3: Selfie / face recognition
    table.string("selfie_url").nullable();

    // Step 4: Community guidelines agreement + final submission
    table.boolean("guidelines_agreed").defaultTo(false);
    table.timestamp("guidelines_agreed_at").nullable();

    // Smile Identity
    table.string("smile_job_id").nullable();
    table.jsonb("smile_result").nullable();

    // Verification status
    table
      .enu("status", ["incomplete", "pending", "verified", "rejected"])
      .defaultTo("incomplete");
    table.text("rejection_reason").nullable();
    table.jsonb("rejection_details").nullable();

    // Track which steps are done
    table.boolean("category_submitted").defaultTo(false);
    table.boolean("document_uploaded").defaultTo(false);
    table.boolean("selfie_submitted").defaultTo(false);

    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("creator_verifications");
};
