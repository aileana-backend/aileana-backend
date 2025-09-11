const mongoose = require("mongoose");
const UserSchema = new mongoose.Schema({
  first_name: { type: String, required: false },
  middle_name: { type: String },
  last_name: { type: String },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
  },
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
  smartReplyEnabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  otp: { type: String },
  otpType: {
    type: String,
    enum: ["", "change", "signup", "reset"],
    default: "",
  },
  otpExpires: { type: Date },
  pendingPassword: { type: String },
  resetVerified: { type: Boolean, default: false },
  resetVerifiedExpires: { type: Date },
});
module.exports = mongoose.model("User", UserSchema);
