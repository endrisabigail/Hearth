import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "../routes/auth.js";
import questRoutes from "../routes/quest.js";
import partyRoutes from "../routes/party.js";
import dashboardRoutes from "../routes/dashboard.js";

dotenv.config();

const app = express();

connectDB();

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? "https://hearth-umber-six.vercel.app"
        : "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/quests", questRoutes);
app.use("/api/party", partyRoutes);
app.use("/api/dashboard", dashboardRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Hearth is running on port ${PORT}`);
});
app.get("/", (req, res) => {
  res.send("Hearth API is alive!");
});