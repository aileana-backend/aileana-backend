require("dotenv").config()

const express = require("express")
const http = require("http")
const cors = require("cors")

const passport = require("passport")
require("./config/passport")
const { Server } = require("socket.io")
const connectDB = require("./config/db")

const authRoutes = require("./routes/auth")
const profileRoutes = require("./routes/profile")
const walletRoutes = require("./routes/wallet")
const messagesRoutes = require("./routes/messages")

const callsRoutes = require("./routes/calls")
const postRoutes = require("./routes/post")
const { verifySocketToken } = require("./middleware/auth")
const Message = require("./models/Message")
const User = require("./models/User")
const monnifyService = require("./monnify/monnify.service")
const walletService = require("./wallet/services/wallet.service")
const { uniqueId } = require("./utils/string.util")
const webhookRoute = require("./wallet/routes/webhook.route")

const app = express()
const server = http.createServer(app)

connectDB()

app.use(cors())
app.use(
	express.json({
		verify: (req, res, buf) => {
			req.rawBody = buf.toString()
		},
	}),
)
app.use(passport.initialize())
// API routes
app.use("/api", authRoutes)
app.use("/api", profileRoutes)
app.use("/api", walletRoutes)
//app.use("/api", messagesRoutes);
app.use("/api", callsRoutes)
app.use("/api", postRoutes)
// webhook route
app.use("/api", webhookRoute)
//testing and commiting
app.get("/", (req, res) => res.send({ status: "Backend runing" }))
app.set("trust proxy", 1)

const io = new Server(server, {
	cors: { origin: "*", methods: ["GET", "POST"] },
})

io.use(async (socket, next) => {
	try {
		await verifySocketToken(socket)
		next()
	} catch (err) {
		next(new Error("Authentication error"))
	}
})

io.on("connection", (socket) => {
	const userId = socket.userId
	console.log("Socket connected", userId)

	// join room for user
	socket.join(`user_${userId}`)

	socket.on("private_message", async (data) => {
		try {
			const { receiver, content } = data
			if (!receiver || !content) {
				return socket.emit("error", { msg: "Recipient and content required" })
			}
			const msg = new Message({
				sender: userId,
				receiver,
				content,
			})
			await msg.save()

			// Emit to receiver and sender
			io.to(`user_${receiver}`).emit("private_message", msg)
			//for the sender only
			socket.emit("private_message", msg)
		} catch (err) {
			console.error("socket message error", err)
			socket.emit("error", { msg: "Message sending failed" })
		}
	})
	socket.on("message_read", async (messageId) => {
		try {
			await Message.findByIdAndUpdate(messageId, { read: true })
		} catch (err) {
			console.error("seen update error", err)
		}
	})
	socket.broadcast.emit("user_online", { userId })
	socket.on("disconnect", () => {
		socket.broadcast.emit("user_offline", { userId })
	})
})
app.use((req, res, next) => {
	req.io = io
	next()
})

app.use("/api", messagesRoutes)

const PORT = process.env.PORT || 4000
server.listen(PORT, async () => {
	console.log(`Server running on port ${PORT}`)

	const newWallet = await walletService.createWallet("68d3ed3483675ab3d739476e")

	const reference1 = uniqueId(12, true) // unique numeric reference
	const reference2 = uniqueId(12, true) // unique numeric reference
	const reference3 = uniqueId(12, true) // unique numeric reference

	if (newWallet) {
		// Testing Race Condition on wallet crediting with same user performing multiple transaction symultaneously
		// Expected result is that each transaction is processed sequentially and wallet balance is correctly updated
		// instead of being corrupted by concurrent updates.
		// const creditResult1 = await walletService.creditWallet(newWallet.id, 10000, 0, reference1, "Initial wallet funding", { source: "system" })
		// const creditResult2 = await walletService.creditWallet(newWallet.id, 10000, 0, reference2, "Initial wallet funding", { source: "system" })
		// const creditResult3 = await walletService.debitWallet(newWallet.id, 5000, 100, reference3, "Initial wallet funding", { source: "system" })
		// console.log("Single sequential transaction results")
		// console.log("====================================")
		// console.log(creditResult1)
		// console.log(creditResult2)
		// console.log(creditResult3)
		// console.log("====================================")
		// Lets produce a parallel processing of the above transactions using Promise.allSettled
		// const [creditResultA, debitResultB, creditResultC, debitResultD] = await Promise.allSettled([
		// 	walletService.creditWallet(newWallet.id, 10000, 0, uniqueId(12, true), "Initial wallet funding", { source: "system" }),
		// 	walletService.debitWallet(newWallet.id, 5000, 100, uniqueId(12, true), "Initial wallet funding", { source: "system" }),
		// 	walletService.creditWallet(newWallet.id, 10000, 0, uniqueId(12, true), "Initial wallet funding", { source: "system" }),
		// 	walletService.debitWallet(newWallet.id, 5000, 100, uniqueId(12, true), "Initial wallet funding", { source: "system" }),
		// ])
		// console.log("Parallel transaction results")
		// console.log(creditResultA)
		// console.log(debitResultB)
		// console.log(creditResultC)
		// console.log(debitResultD)
	}
})
