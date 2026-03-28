exports.up = function (knex) {
  return knex.schema.createTable("service_provider_verifications", function (table) {
    table.increments("id").primary();
    table.string("user_id").notNullable().unique();

    // Step 1: Personal info
    table.string("full_name").nullable();
    table.string("phone_number").nullable();
    table.string("country").nullable();
    table.string("city").nullable();

    // Step 2: Service details
    table.string("service_name").nullable();
    table.string("service_category").nullable();
    table.text("service_description").nullable();
    table.integer("years_of_experience").nullable();

    // Step 3: Service coverage
    table.specificType("coverage_areas", "text[]").nullable();
    table.string("coverage_radius").nullable();

    // Step 4: Identity document
    table
      .enu("document_type", ["national_id", "passport", "drivers_license"])
      .nullable();
    table.string("front_image_url").nullable();
    table.string("back_image_url").nullable();

    // Step 5: Selfie / face recognition
    table.string("selfie_url").nullable();

    // Step 6: Payout method
    table.string("bank_name").nullable();
    table.string("account_number").nullable();
    table.string("account_name").nullable();

    // Step 7: Terms & Agreement
    table.boolean("terms_agreed").defaultTo(false);
    table.timestamp("terms_agreed_at").nullable();

    // Smile Identity
    table.string("smile_job_id").nullable();
    table.jsonb("smile_result").nullable();

    // Verification status
    table
      .enu("status", ["incomplete", "pending", "verified", "rejected"])
      .defaultTo("incomplete");
    table.text("rejection_reason").nullable();
    table.jsonb("rejection_details").nullable();

    // Step completion flags
    table.boolean("basic_info_submitted").defaultTo(false);
    table.boolean("service_details_submitted").defaultTo(false);
    table.boolean("service_coverage_submitted").defaultTo(false);
    table.boolean("document_uploaded").defaultTo(false);
    table.boolean("selfie_submitted").defaultTo(false);
    table.boolean("payout_method_submitted").defaultTo(false);

    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("service_provider_verifications");
};
