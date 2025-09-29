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
const { verifySocketToken } = require("./middleware/auth");
const Message = require("./models/Message");
const User = require("./models/User");

const app = express();
const server = http.createServer(app);

connectDB();

app.use(cors());
app.use(express.json());
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

      // Emit to receiver and sender
      io.to(`user_${receiver}`).emit("private_message", msg);
      //for the sender only
      socket.emit("private_message", msg);
    } catch (err) {
      console.error("socket message error", err);
      socket.emit("error", { msg: "Message sending  faild" });
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
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
