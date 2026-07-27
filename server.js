import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import authRoutes from "../routes/auth.js";
import questRoutes from "../routes/quest.js";
import partyRoutes from "../routes/party.js";
import dashboardRoutes from "../routes/dashboard.js";
import agentRoutes from "../routes/agent.js";
import initPlazaSocket from "./sockets/plaza.js";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}
const app = express();

connectDB();

const corsOrigin =
  process.env.NODE_ENV === "production"
    ? "https://hearth-umber-six.vercel.app"
    : "http://localhost:5173";

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/quests", questRoutes);
app.use("/api/party", partyRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/agent", agentRoutes);

app.get("/", (req, res) => {
  res.send("Hearth API is alive!");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    credentials: true,
  },
});

initPlazaSocket(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Hearth is running on port ${PORT}`);
});