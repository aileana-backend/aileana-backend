exports.up = function (knex) {
  return knex.schema.createTable("vendor_verifications", function (table) {
    table.increments("id").primary();
    table.string("user_id").notNullable().unique();

    // Step 1: Basic personal info
    table.string("full_name");
    table.string("business_name");
    table.string("phone_number");
    table.string("country");
    table.string("city");

    // Step 2: Document
    table
      .enu("document_type", ["national_id", "passport", "drivers_license"])
      .nullable();
    table.string("front_image_url").nullable();
    table.string("back_image_url").nullable();

    // Step 3: Selfie / face recognition
    table.string("selfie_url").nullable();

    // Step 4: Business details
    table.string("shop_name").nullable();
    table.string("shop_category").nullable();
    table.text("shop_description").nullable();
    table.integer("years_of_experience").nullable();
    table.string("website").nullable();

    // Step 5: Payout method
    table.string("bank_name").nullable();
    table.string("account_number").nullable();
    table.string("account_name").nullable();

    // Step 6: Terms & Agreement
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
    table.jsonb("rejection_details").nullable(); // e.g. ["Blurry ID Document", "Selfie Verification Failed"]

    // Track which steps are done
    table.boolean("basic_info_submitted").defaultTo(false);
    table.boolean("document_uploaded").defaultTo(false);
    table.boolean("selfie_submitted").defaultTo(false);
    table.boolean("business_details_submitted").defaultTo(false);
    table.boolean("payout_method_submitted").defaultTo(false);

    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("vendor_verifications");
};
