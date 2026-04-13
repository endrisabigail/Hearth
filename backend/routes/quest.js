import express from "express";
import User from "../models/user.js";
import Quest from "../models/quest.js";
import Notification from "../models/notification.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/quests
// get all quests for the user's party
router.get("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    if (!user?.partyId)
      return res.status(400).json({ msg: "You are not in a party." });

    const quests = await Quest.find({ partyId: user.partyId })
      .populate("assignedTo", "username avatarId")
      .populate("completedBy", "username avatarId")
      .sort({ createdAt: -1 });

    res.json(quests);
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

    const { title, description, dueDate, category, assignedTo } = req.body;

    const quest = new Quest({
      title,
      description,
      dueDate,
      category: category || "general",
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

    res.status(201).json(quest);
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

    res.json(quest);
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

    res.json({
      msg: "Quest completed!",
      points: currentUser.totalPoints,
      newBadge: newBadge?.badgeName || null,
      allBadges: currentUser.badges,
    });
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
