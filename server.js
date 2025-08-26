require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const walletRoutes = require("./routes/wallet");
const messagesRoutes = require("./routes/messages");
const callsRoutes = require("./routes/calls");
const { verifySocketToken } = require("./middleware/auth");
const Message = require("./models/Message");
const User = require("./models/User");

const app = express();
const server = http.createServer(app);

connectDB();

app.use(cors());
app.use(express.json());
// API routes
app.use("/api", authRoutes);
app.use("/api", profileRoutes);
app.use("/api", walletRoutes);
app.use("/api", messagesRoutes);
app.use("/api", callsRoutes);

app.get("/", (req, res) =>
  res.send({ status: "Franklin Akabueze Aileana backend running" })
);

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
      const { to, content } = data;
      if (!to || !content) return;
      const msg = new Message({
        from: userId,
        to,
        content,
        timestamp: new Date(),
      });
      await msg.save();

      // Emit to receiver and sender
      io.to(`user_${to}`).emit("private_message", msg);
      socket.emit("private_message", msg);
    } catch (err) {
      console.error("socket message error", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected", userId);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
