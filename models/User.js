const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  first_name: { type: String, required: false },
  middle_name: { type: String },
  last_name: { type: String },
  //name: { type: String },
  email: { type: String, required: true, unique: true, index: true },
  // phone: { type: String },
  // dob: { type: Date },
  // gender: { type: String, enum: ["Male", "Female", "Other"] },
  // title: { type: String },
  // address_line_1: { type: String },
  // address_line_2: { type: String },
  // city: { type: String },
  // state: { type: String },
  // country: { type: String },
  password: { type: String, default: "" },
  // avatar: { type: String, default: "" },
  // createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);
