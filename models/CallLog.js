const mongoose = require("mongoose");

const CallLogSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  status: {
    type: String,
    enum: ["started", "ended", "missed"],
    default: "started",
  },
  meta: { type: Object, default: {} },
});

module.exports = mongoose.model("CallLog", CallLogSchema);
