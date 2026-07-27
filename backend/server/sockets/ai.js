import { getAuth } from "firebase-admin/auth";
import firebaseApp from "../config/firebaseAdmin.js";
import User from "../../models/user.js";
import ChatMessage from "../../models/chatMessage.js";
import { streamChat } from "../services/ollamaService.js";

const HISTORY_LIMIT = 20; // how many past messages to feed back as context

export default function initAiSocket(io) {
  const ai = io.of("/ai");

   ai.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token provided"));

      const decoded = await getAuth(firebaseApp).verifyIdToken(token);
      const user = await User.findOne({ firebaseUid: decoded.uid });

      if (!user) return next(new Error("No matching profile"));

      socket.userId = user._id.toString();
      next();
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });

  ai.on("connection", (socket) => {
    // track whether this socket has a generation in flight to prevent 
    // spam prompts and overlap streams
    let generating = false;

    socket.on("ai:prompt", async ({ prompt, conversationId }) => {
      if (!prompt || typeof prompt !== "string" || !prompt.trim()) return;
      if (generating) {
        socket.emit("ai:error", { msg: "Please wait for the current response to finish." });
        return;
      }

      const convoId =
        conversationId && typeof conversationId === "string"
          ? conversationId
          : `${socket.userId}-default`;

      generating = true;

      try {
        // save the user's message first
        await ChatMessage.create({
          userId: socket.userId,
          conversationId: convoId,
          role: "user",
          content: prompt.trim(),
        });

        // pull recent history for context (oldest → newest)
        const history = await ChatMessage.find({
          userId: socket.userId,
          conversationId: convoId,
        })
          .sort({ createdAt: -1 })
          .limit(HISTORY_LIMIT)
          .then((docs) => docs.reverse());

        const messages = history.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        socket.emit("ai:start", { conversationId: convoId });

        const fullText = await streamChat(messages, (chunk) => {
          socket.emit("ai:chunk", { conversationId: convoId, chunk });
        });

        await ChatMessage.create({
          userId: socket.userId,
          conversationId: convoId,
          role: "assistant",
          content: fullText,
        });

        socket.emit("ai:done", { conversationId: convoId });
      } catch (err) {
        console.error("AI stream error:", err.message);
        socket.emit("ai:error", { msg: "AI response failed. Is Ollama running?" });
      } finally {
        generating = false;
      }
    });
  });
}
