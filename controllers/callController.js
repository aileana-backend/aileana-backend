const CallLog = require("../models/CallLog");

const startCall = async (req, res) => {
  try {
    const from = req.user._id;
    const { to } = req.body;
    if (!to) return res.status(400).json({ msg: "to is required" });

    const call = new CallLog({
      from,
      to,
      status: "started",
      startedAt: new Date(),
    });
    await call.save();

    // In real app you'd send signaling events via socket; we mock it
    res.json({ msg: "Call started (mock)", call });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

const endCall = async (req, res) => {
  try {
    const { callId } = req.body;
    if (!callId) return res.status(400).json({ msg: "callId required" });

    const call = await CallLog.findById(callId);
    if (!call) return res.status(404).json({ msg: "Call not found" });

    call.status = "ended";
    call.endedAt = new Date();
    await call.save();

    res.json({ msg: "Call ended (mock)", call });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

module.exports = { startCall, endCall };
