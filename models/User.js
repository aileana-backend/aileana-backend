const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  first_name: { type: String, required: false },
  middle_name: { type: String },
  last_name: { type: String },
  username: { type: String },
  email: { type: String, required: true, unique: true, index: true },

  dob: { type: Date },
  gender: {
    type: String,
    enum: ["Male", "Female", "Other", "Prefer not to say"],
  },

  password: { type: String, default: "" },

  biometricPreference: {
    type: String,
    enum: ["None", "FaceID", "Fingerprint"],
    default: "None",
  },
  termsAccepted: { type: Boolean, required: true },
  verified: { type: Boolean, required: false },
  createdAt: { type: Date, default: Date.now },
  otp: { type: String },
  otpType: {
    type: String,
    enum: ["", "change", "signup", "reset"],
    default: "",
  },
  otpExpires: { type: Date },
  pendingPassword: { type: String },
});

UserSchema.pre("save", async function (next) {
  if (this.isNew && !this.username) {
    // e.g., take first part of email + random suffix
    let base = this.email.split("@")[0];
    let username = base.toLowerCase();

    // Ensure uniqueness
    let exists = await this.constructor.findOne({ username });
    let counter = 1;

    while (exists) {
      username = `${base}${counter}`;
      exists = await this.constructor.findOne({ username });
      counter++;
    }

    this.username = username;
  }
  next();
});

module.exports = mongoose.model("User", UserSchema);
