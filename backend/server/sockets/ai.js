import { getAuth } from "firebase-admin/auth";
import firebaseApp from "../config/firebaseAdmin.js";
import User from "../../models/user.js";
import ChatMessage from "../../models/chatMessage.js";
import Quest from "../../models/quest.js";
import { streamChat } from "../services/aiService.js";

const HISTORY_LIMIT = 20; // how many past messages to feed back as context


function buildBreakdownPrompt(quest) {
  return [
    "You are a friendly companion character in a gamified quest app called Hearth, helping a user get started on a task they've been putting off.",
    "Break the quest below into 3-5 short, concrete, encouraging steps that make it feel doable. No preamble, no restating the title, no sign-off — just the steps.",
    "Keep the whole thing under 120 words. Use a numbered list.",
    "",
    `Quest: ${quest.title}`,
    `Details: ${quest.description || "(no extra details given)"}`,
    `Category: ${quest.category || "general"}`,
  ].join("\n");
}

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

    // "I can help!!" button on the quest modal — one-shot task breakdown,
    // scoped to a single quest rather than the ongoing companion thread.
    socket.on("ai:breakdown", async ({ questId, regenerate }) => {
      if (!questId || typeof questId !== "string") return;
      if (generating) {
        socket.emit("ai:breakdown:error", {
          questId,
          msg: "Please wait for the current response to finish.",
        });
        return;
      }

      try {
        const [user, quest] = await Promise.all([
          User.findById(socket.userId),
          Quest.findById(questId),
        ]);

        if (!quest) {
          socket.emit("ai:breakdown:error", { questId, msg: "Quest not found." });
          return;
        }
        if (!user?.partyId || quest.partyId.toString() !== user.partyId.toString()) {
          socket.emit("ai:breakdown:error", { questId, msg: "Not your party." });
          return;
        }

        // serve the cached breakdown unless the user explicitly asked to redo it
        if (quest.aiBreakdown && !regenerate) {
          socket.emit("ai:breakdown:start", { questId, cached: true });
          socket.emit("ai:breakdown:chunk", { questId, chunk: quest.aiBreakdown });
          socket.emit("ai:breakdown:done", { questId, cached: true });
          return;
        }

        generating = true;
        socket.emit("ai:breakdown:start", { questId, cached: false });

        const prompt = buildBreakdownPrompt(quest);
        const fullText = await streamChat(
          [{ role: "user", content: prompt }],
          (chunk) => socket.emit("ai:breakdown:chunk", { questId, chunk }),
        );

        quest.aiBreakdown = fullText;
        await quest.save();

        socket.emit("ai:breakdown:done", { questId, cached: false });
      } catch (err) {
        console.error("AI breakdown error:", err.message);
        socket.emit("ai:breakdown:error", {
          questId,
          msg: "Couldn't get steps together. Is Ollama running?",
        });
      } finally {
        generating = false;
      }
    });
  });
}