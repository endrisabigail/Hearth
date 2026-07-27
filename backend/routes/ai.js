import express from "express";
import ChatMessage from "../models/chatMessage.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/ai/history/:conversationId
// used to repopulate the chat window on page load/refresh
router.get("/history/:conversationId", protect, async (req, res) => {
  try {
    const messages = await ChatMessage.find({
      userId: req.user,
      conversationId: req.params.conversationId,
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// DELETE /api/ai/history/:conversationId
// clear a conversation
router.delete("/history/:conversationId", protect, async (req, res) => {
  try {
    await ChatMessage.deleteMany({
      userId: req.user,
      conversationId: req.params.conversationId,
    });
    res.json({ msg: "Conversation cleared." });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

export default router;
