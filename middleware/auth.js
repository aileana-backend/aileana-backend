const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  try {
    const header = req.header("Authorization") || "";
    if (!header.startsWith("Bearer "))
      return res.status(401).json({ msg: "No token" });
    const token = header.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ msg: "Invalid token" });
    req.user = user;
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ msg: "Unauthorized" });
  }
};

const verifySocketToken = async (socket) => {
  const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;
  if (!token) throw new Error("No token");
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new Error("Invalid or expired token");
  }

  socket.userId = decoded.id;
  const user = await User.findById(decoded.id);
  if (!user) throw new Error("Invalid token");
  socket.user = user;
};

module.exports = { auth, verifySocketToken };
