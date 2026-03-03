const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  first_name: { type: String },
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
  dob: { type: Date, required: false },
  gender: {
    type: String,
    enum: ["Male", "Female", "Other", "Prefer not to say", "", null],
    default: "",
  },

  password: { type: String, default: "" },

  biometricPreference: {
    type: String,
    enum: ["None", "FaceID", "Fingerprint"],
    default: "None",
  },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  termsAccepted: { type: Boolean, required: true },

  verified: { type: Boolean, default: false },

  smartReplyEnabled: { type: Boolean, default: false },
<<<<<<< HEAD
  store: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },
  createdAt: { type: Date, default: Date.now },
=======

  bvn: {
    type: String,
    minlength: 11,
    maxlength: 11,
    unique: true,
    sparse: true,
  },

  nin: {
    type: String,
    minlength: 11,
    maxlength: 11,
    unique: true,
    sparse: true,
  },

  kyc_completed: { type: Boolean, default: false },


  kyc_document: {
    type: {
      type: String,
      enum: ["national_id", "passport", "drivers_license"],
    },
    front_image_url: { type: String },
    back_image_url: { type: String },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    uploaded_at: { type: Date },
    rejection_reason: { type: String },
  },

  kyc_document: {
  type: { type: String, enum: ["national_id", "passport", "drivers_license"] },
  front_image_url: { type: String },
  selfie_url: { type: String },       // ✅ add this
  job_id: { type: String },           // ✅ add this
  status: {
    type: String,
    enum: ["pending", "verified", "rejected"],
    default: "pending",
  },
  uploaded_at: { type: Date },
  rejection_reason: { type: String },
},

  address: { type: String, default: "" },
  city: { type: String, default: "" },
  state: { type: String, default: "" },
  phone_number: { type: String, default: "" },

  status: {
    type: String,
    enum: ["inactive", "active", "suspended"],
    default: "active",
  },

  store: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },
>>>>>>> payment
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

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);