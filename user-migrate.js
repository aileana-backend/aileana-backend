// scripts/migrate-users.js
const mongoose = require("mongoose");
const knex = require("../aileana-backend/config/pg");
const UserModel = require("../aileana-backend/models/User");

async function migrateUsers() {
  try {
    // 1. Connect to MongoDB
    const uri = await mongoose.connect(process.env.MONGO_URI);
    console.log("uri", uri);
    console.log("MongoDB connected");

    // 2. Fetch all users from MongoDB
    const mongoUsers = await UserModel.find({});
    console.log(`Found ${mongoUsers.length} users to migrate`);

    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of mongoUsers) {
      try {
        const inserted = await knex("users")
          .insert({
            mongo_id: user._id.toString(),
            first_name: user.first_name || null,
            middle_name: user.middle_name || null,
            last_name: user.last_name || null,
            username: user.username,
            email: user.email,
            dob: user.dob || null,
            gender: user.gender || null,
            phone_number: user.phone_number || "",
            address: user.address || "",
            city: user.city || "",
            state: user.state || "",
            password: user.password || "",
            transaction_pin: user.transaction_pin || null,
            biometric_preference: user.biometricPreference || "None",
            status: user.status || "active",
            verified: user.verified || false,
            is_online: user.isOnline || false,
            last_seen: user.lastSeen || new Date(),
            terms_accepted: user.termsAccepted || false,
            smart_reply_enabled: user.smartReplyEnabled || false,

            // OTP
            otp: user.otp || null,
            otp_type: user.otp_type || "",
            otp_expires: user.otp_expires || null,
            pending_password: user.pending_password || null,
            reset_verified: user.reset_verified || false,
            reset_verified_expires: user.reset_verified_expires || null,

            // KYC
            bvn: user.bvn || null,
            nin: user.nin || null,
            kyc_completed: user.kyc_completed || false,
            kyc_doc_type: user.kyc_document?.doc_type || null,
            kyc_front_image_url: user.kyc_document?.front_image_url || null,
            kyc_back_image_url: user.kyc_document?.back_image_url || null,
            kyc_selfie_url: user.kyc_document?.selfie_url || null,
            kyc_job_id: user.kyc_document?.job_id || null,
            kyc_status: user.kyc_document?.status || "pending",
            kyc_uploaded_at: user.kyc_document?.uploaded_at || null,
            kyc_rejection_reason: user.kyc_document?.rejection_reason || null,

            created_at: user.createdAt || new Date(),
            updated_at: new Date(),
          })
          .onConflict("email")
          .ignore();

        if (inserted.length === 0) {
          skipped++;
          console.log(`⏭  Skipped (duplicate): ${user.email}`);
        } else {
          success++;
          console.log(`✅ Migrated: ${user.email}`);
        }
      } catch (err) {
        failed++;
        console.error(`❌ Failed: ${user.email} — ${err.message}`);
      }
    }

    console.log("─────────────────────────────");
    console.log(`✅ Success: ${success}`);
    console.log(`⏭  Skipped: ${skipped}`);
    console.log(`❌ Failed:  ${failed}`);
    console.log("Migration complete");

    await mongoose.disconnect();
    console.log("MongoDB disconnected");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateUsers();
