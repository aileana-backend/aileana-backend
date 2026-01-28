require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");

const passport = require("passport");
require("./config/passport");
const { Server } = require("socket.io");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const walletRoutes = require("./routes/wallet");
const messagesRoutes = require("./routes/messages");
const storeRoutes = require("./routes/store");
const callsRoutes = require("./routes/calls");
const categoryRoutes = require("./routes/category");
const postRoutes = require("./routes/post");
const productRoutes = require("./routes/product");
const webhookRoute = require("./routes/webhook");
const { verifySocketToken } = require("./middleware/auth");
const Message = require("./models/Message");
const User = require("./models/User");
//const monnifyService = require("./services/monnify/monnify.service");
//const walletService = require("./wallet/services/wallet.service");
const { uniqueId } = require("./utils/string.util");

const app = express();
const server = http.createServer(app);

connectDB();

app.use(cors());
app.use(express.json());

function sanitizeBody(body = {}) {
  const SENSITIVE_FIELDS = [
    "password",
    "confirmPassword",
    "pin",
    "otp",
    "token",
    "accessToken",
    "refreshToken",
  ];

  const sanitized = { ...body };

  for (const field of SENSITIVE_FIELDS) {
    if (sanitized[field]) {
      sanitized[field] = "********";
    }
  }

  return sanitized;
}

// --- 1. DEFINE HELPERS FIRST ---
function getLoggerForStatusCode(statusCode) {
  if (statusCode >= 500) return console.error.bind(console);
  if (statusCode >= 400) return console.warn.bind(console);
  return console.info.bind(console);
}

// --- 2. ADD THE MIDDLEWARE HERE (BEFORE ROUTES) ---
app.use((req, res, next) => {
  res.on("finish", () => {
    const logger = getLoggerForStatusCode(res.statusCode);

    const safeBody = sanitizeBody(req.body);

    logger(
      `[${new Date().toISOString()}] ${req.method} ${
        req.originalUrl
      } ${JSON.stringify(safeBody)} ${res.statusCode}`,
    );
  });

  next();
});

app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// API routes
app.use("/api", authRoutes);
app.use("/api", profileRoutes);
app.use("/api", walletRoutes);
app.use("/api", storeRoutes);
app.use("/api", categoryRoutes);
app.use("/api", productRoutes);
app.use("/api", callsRoutes);
app.use("/api", postRoutes);
app.use("/api", authRoutes);
// webhook route
app.use("/api", webhookRoute);
//testing and commiting
app.get("/", (req, res) => res.send({ status: "Backend runing" }));
app.set("trust proxy", 1);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.use(async (socket, next) => {
  try {
    await verifySocketToken(socket);
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.userId;
  console.log("Socket connected", userId);

  // join room for user
  socket.join(`user_${userId}`);

  socket.on("private_message", async (data) => {
    try {
      const { receiver, content } = data;

      if (!receiver || !content) {
        return socket.emit("error", { msg: "Recipient and content required" });
      }

      const msg = new Message({
        sender: userId,
        receiver,
        content,
      });

      await msg.save();

      // Emit once per user via rooms
      io.to(`user_${receiver}`).emit("private_message", msg);
      io.to(`user_${userId}`).emit("private_message", msg);
    } catch (err) {
      console.error("socket message error", err);
      socket.emit("error", { msg: "Message sending failed" });
    }
  });

  socket.on("message_read", async (messageId) => {
    try {
      await Message.findByIdAndUpdate(messageId, { read: true });
    } catch (err) {
      console.error("seen update error", err);
    }
  });
  socket.broadcast.emit("user_online", { userId });
  socket.on("disconnect", async () => {
    try {
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      socket.broadcast.emit("user_offline", { userId });
    } catch (err) {
      console.error("Error updating user on disconnect:", err);
    }
  });
});
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use("/api", messagesRoutes);

const PORT = process.env.PORT || 4000;
console.log("PORT", PORT);
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
