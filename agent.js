import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import User from "../models/user.js";
import Quest from "../models/quest.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// reads ANTHROPIC_API_KEY from process.env automatically -- make sure
// it's set in backend/.env (and never committed)
const anthropic = new Anthropic();

const MAX_HISTORY = 10; // trim so token usage doesn't grow unbounded

// POST /api/agent/ask
// the Hearth guide companion -- answers with real context about the
// user's streak and active party quests
router.post("/ask", protect, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ msg: "No matching profile." });
    }

    const { message, history = [] } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ msg: "Message is required." });
    }

    const user = await User.findById(req.user).select(
      "username rank streak partyId",
    );
    if (!user) return res.status(404).json({ msg: "User not found." });

    const activeQuests = user.partyId
      ? await Quest.find({
          partyId: user.partyId,
          status: { $ne: "Completed" },
        })
          .select("title description assignedTo")
          .limit(5)
      : [];

    const questSummary = activeQuests.length
      ? activeQuests.map((q) => `- "${q.title}": ${q.description}`).join("\n")
      : "No active quests right now.";

    const systemPrompt = `You are the Hearth guide, a small friendly companion creature who lives in ${user.username}'s shared 3D plaza in the Hearth app.
You help them understand their quests, streak, and how the plaza works. Keep replies short (2-4 sentences), warm, and encouraging. Plain text only, no markdown.

${user.username}'s rank: ${user.rank}
${user.username}'s current streak: ${user.streak?.current || 0} day(s)
Active party quests:
${questSummary}`;

    // client sends prior turns as [{ role: "user" | "assistant", content }]
    const trimmedHistory = history
      .slice(-MAX_HISTORY)
      .filter((m) => m?.content?.trim())
      .map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));

    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 300,
      system: systemPrompt,
      messages: [...trimmedHistory, { role: "user", content: message }],
    });

    const reply =
      response.content.find((block) => block.type === "text")?.text ||
      "sorry, i didn't quite catch that!";

    res.json({ reply });
  } catch (err) {
    console.error("agent ask failed:", err.message);
    res.status(500).json({ msg: "The guide is unavailable right now." });
  }
});

export default router;
