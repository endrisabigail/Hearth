import express from "express";
import User from "../models/user.js";
import Quest from "../models/quest.js";
import Notification from "../models/notification.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

const POPULATE_FIELDS = [
  { path: "assignedTo", select: "username avatarId" },
  { path: "completedBy", select: "username avatarId" },
  { path: "comments.author", select: "username avatarId" },
  { path: "editHistory.editedBy", select: "username avatarId" },
];

function formatQuestForUser(quest, userId) {
  const obj = quest.toObject({ virtuals: true });
  obj.comments = (obj.comments || []).map((c) => ({
    ...c,
    isMine: c.author?._id?.toString() === userId?.toString(),
  }));
  return obj;
}

async function loadPopulatedQuest(id) {
  return Quest.findById(id).populate(POPULATE_FIELDS);
}
const EDITABLE_FIELDS = [
  "title",
  "description",
  "dueDate",
  "category",
  "points",
  "assignedTo",
  "tags",
  "priority",
];

// GET /api/quests
// get all quests for the user's party
router.get("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    if (!user?.partyId)
      return res.status(400).json({ msg: "You are not in a party." });

    const quests = await Quest.find({ partyId: user.partyId })
      .populate(POPULATE_FIELDS)
      .sort({ createdAt: -1 });

    res.json(quests.map((q) => formatQuestForUser(q, req.user)));
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// POST /api/quests
// create a quest (owner only)
router.post("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    if (!user?.partyId)
      return res.status(400).json({ msg: "You are not in a party." });
    if (!user.isPartyOwner)
      return res
        .status(403)
        .json({ msg: "Only the party lead can create quests." });

    const {
      title,
      description,
      dueDate,
      category,
      assignedTo,
      tags,
      priority,
      points,
    } = req.body;

    const quest = new Quest({
      title,
      description,
      dueDate,
      category: category || "general",
      priority: priority || "medium",
      tags: Array.isArray(tags) ? tags : [],
      points: typeof points === "number" ? points : 5,
      partyId: user.partyId,
      createdBy: req.user,
      assignedTo: assignedTo || null,
    });

    await quest.save();

    // notify assigned member if there is one
    if (assignedTo) {
      await Notification.create({
        recipient: assignedTo,
        type: "quest_assigned",
        message: `You've been assigned a new quest: "${title}" ⚔️`,
        fromUser: req.user,
      });
    }

    const populated = await loadPopulatedQuest(quest._id);
    res.status(201).json(formatQuestForUser(populated, req.user));
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// PUT /api/quests/:id
router.put("/:id", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    const quest = await Quest.findById(req.params.id);

    if (!quest) return res.status(404).json({ msg: "Quest not found." });
    if (!user?.partyId || quest.partyId.toString() !== user.partyId.toString())
      return res.status(403).json({ msg: "Not your party." });
    if (!user.isPartyOwner)
      return res.status(403).json({ msg: "Only the party lead can edit quests." });

    const changes = [];

    for (const field of EDITABLE_FIELDS) {
      if (!(field in req.body)) continue;

      let newValue = req.body[field];
      if (field === "dueDate" && newValue) newValue = new Date(newValue);
      if (field === "assignedTo" && !newValue) newValue = null;

      const oldValue = quest[field];
      const oldComparable =
        field === "dueDate" && oldValue ? oldValue.toISOString() : oldValue;
      const newComparable =
        field === "dueDate" && newValue ? newValue.toISOString() : newValue;
      const oldForHistory =
        field === "assignedTo" || field === "tags"
          ? JSON.stringify(oldValue ?? null)
          : oldComparable;
      const newForHistory =
        field === "assignedTo" || field === "tags"
          ? JSON.stringify(newValue ?? null)
          : newComparable;

      if (oldForHistory !== newForHistory) {
        changes.push({
          field,
          oldValue: field === "tags" ? (oldValue || []).join(", ") : oldValue,
          newValue: field === "tags" ? (newValue || []).join(", ") : newValue,
          editedBy: req.user,
          editedAt: new Date(),
        });
      }

      quest[field] = newValue;
    }

    if (changes.length) {
      quest.editHistory.push(...changes);
    }

    await quest.save();

    const populated = await loadPopulatedQuest(quest._id);
    res.json(formatQuestForUser(populated, req.user));
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// PUT /api/quests/:id/status
// update quest status (any member can do this)
router.put("/:id/status", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    const quest = await Quest.findById(req.params.id);

    if (!quest) return res.status(404).json({ msg: "Quest not found." });
    if (quest.partyId.toString() !== user.partyId.toString())
      return res.status(403).json({ msg: "Not your party." });

    const validStatuses = ["Not Started", "In Progress", "Completed"];
    if (!validStatuses.includes(req.body.status))
      return res.status(400).json({ msg: "Invalid status value." });

    quest.status = req.body.status;
    await quest.save();

    const populated = await loadPopulatedQuest(quest._id);
    res.json(formatQuestForUser(populated, req.user));
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// POST /api/quests/complete
// complete a quest and award points + badges
router.post("/complete", protect, async (req, res) => {
  try {
    const { questId } = req.body;

    const currentUser = await User.findById(req.user);
    const currentQuest = await Quest.findById(questId);

    if (!currentQuest) return res.status(404).json({ msg: "Quest not found." });
    if (currentQuest.status === "Completed")
      return res.status(400).json({ msg: "Quest already completed." });
    if (currentQuest.partyId.toString() !== currentUser.partyId.toString())
      return res.status(403).json({ msg: "Not your party." });

    // mark quest complete
    currentQuest.status = "Completed";
    currentQuest.completedBy = req.user;
    currentQuest.completedAt = new Date();
    await currentQuest.save();

    // award points based on quest's point value
    const category = currentQuest.category;
    const questPoints = currentQuest.points;
    if (!currentUser.points.get(category)) currentUser.points.set(category, 0);
    currentUser.points.set(
      category,
      currentUser.points.get(category) + questPoints,
    );
    currentUser.totalPoints += questPoints;

    const currentPoints = currentUser.points.get(category);

    // badge logic
    let newBadge = null;
    if (currentPoints >= 5 && currentPoints - questPoints < 5) {
      // crossed the 5 point threshold for the first time
      newBadge = {
        badgeName: `${category} First Timer`,
        badgeDescription: "Congratulations on completing your first quest!",
        earnedAt: new Date(),
      };
    } else if (
      Math.floor(currentPoints / 20) >
      Math.floor((currentPoints - questPoints) / 20)
    ) {
      // crossed a 20-point milestone
      const milestone = Math.floor(currentPoints / 20) * 20;
      newBadge = {
        badgeName: `${category} Level ${milestone}`,
        badgeDescription: `You've earned ${milestone} points in ${category}!`,
        earnedAt: new Date(),
      };
    }

    if (newBadge) {
      const alreadyHas = currentUser.badges.some(
        (b) => b.badgeName === newBadge.badgeName,
      );
      if (!alreadyHas) {
        currentUser.badges.push(newBadge);

        await Notification.create({
          recipient: currentUser._id,
          type: "badge_earned",
          message: `You earned the "${newBadge.badgeName}" badge! 🏅`,
        });
      } else {
        newBadge = null;
      }
    }

    // notify party owner that quest was completed
    const partyOwner = await User.findOne({
      partyId: currentUser.partyId,
      isPartyOwner: true,
    });
    if (partyOwner && partyOwner._id.toString() !== req.user.toString()) {
      await Notification.create({
        recipient: partyOwner._id,
        type: "quest_complete",
        message: `${currentUser.username} completed "${currentQuest.title}"! ⚔️`,
        fromUser: req.user,
      });
    }

    await currentUser.save();

    const populated = await loadPopulatedQuest(currentQuest._id);

    res.json(formatQuestForUser(populated, req.user));
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// POST /api/quests/:id/comments
// add a comment (any party member)
router.post("/:id/comments", protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim())
      return res.status(400).json({ msg: "Comment text is required." });

    const user = await User.findById(req.user);
    const quest = await Quest.findById(req.params.id);

    if (!quest) return res.status(404).json({ msg: "Quest not found." });
    if (!user?.partyId || quest.partyId.toString() !== user.partyId.toString())
      return res.status(403).json({ msg: "Not your party." });

    quest.comments.push({
      text: text.trim(),
      author: req.user,
      createdAt: new Date(),
    });
    await quest.save();

    const populated = await loadPopulatedQuest(quest._id);
    res.json(formatQuestForUser(populated, req.user));
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// DELETE /api/quests/:id/comments/:commentId
// remove a comment (the quest owner, or whoever wrote it)
router.delete("/:id/comments/:commentId", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    const quest = await Quest.findById(req.params.id);

    if (!quest) return res.status(404).json({ msg: "Quest not found." });
    if (!user?.partyId || quest.partyId.toString() !== user.partyId.toString())
      return res.status(403).json({ msg: "Not your party." });

    const comment = quest.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ msg: "Comment not found." });

    const isCommentAuthor = comment.author.toString() === req.user.toString();
    if (!user.isPartyOwner && !isCommentAuthor)
      return res.status(403).json({ msg: "You can't delete this comment." });

    comment.deleteOne();
    await quest.save();

    const populated = await loadPopulatedQuest(quest._id);
    res.json(formatQuestForUser(populated, req.user));
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// PUT /api/quests/:id/checklist
router.put("/:id/checklist", protect, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items))
      return res.status(400).json({ msg: "Checklist items must be an array." });

    const user = await User.findById(req.user);
    const quest = await Quest.findById(req.params.id);

    if (!quest) return res.status(404).json({ msg: "Quest not found." });
    if (!user?.partyId || quest.partyId.toString() !== user.partyId.toString())
      return res.status(403).json({ msg: "Not your party." });

    quest.checklist = items.map((it) => ({
      text: String(it.text ?? "").slice(0, 300),
      done: Boolean(it.done),
    }));
    await quest.save();

    const populated = await loadPopulatedQuest(quest._id);
    res.json(formatQuestForUser(populated, req.user));
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// DELETE /api/quests/:id
// delete a quest (owner only)
router.delete("/:id", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    if (!user.isPartyOwner)
      return res
        .status(403)
        .json({ msg: "Only the party lead can delete quests." });

    await Quest.findByIdAndDelete(req.params.id);
    res.json({ msg: "Quest deleted." });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

export default router;