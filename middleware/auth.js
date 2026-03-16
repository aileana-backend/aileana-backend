const jwt = require("jsonwebtoken");
const knex = require("../config/pg");

const auth = async (req, res, next) => {
  try {
    const header = req.header("Authorization") || "";
    if (!header.startsWith("Bearer "))
      return res.status(401).json({ msg: "No token" });

    const token = header.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await knex("users")
      .where({ id: decoded.id })
      .select("*")
      .first();

    if (!user) return res.status(401).json({ msg: "Invalid token" });

    // Remove password from user object
    delete user.password;
    delete user.transaction_pin;

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

  const user = await knex("users").where({ id: decoded.id }).first();

  if (!user) throw new Error("Invalid token");

  // Update online status
  await knex("users").where({ id: user.id }).update({
    is_online: true,
    last_seen: new Date(),
    updated_at: new Date(),
  });

  delete user.password;
  delete user.transaction_pin;

  socket.userId = user.id;
  socket.user = user;
};

module.exports = { auth, verifySocketToken };
