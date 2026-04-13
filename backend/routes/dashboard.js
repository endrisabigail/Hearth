import express from "express";
import User from "../models/user.js";
import Quest from "../models/quest.js";
import Notification from "../models/notification.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/dashboard
// returns everything the dashboard needs in one call
router.get("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user)
      .populate("neighbors", "username rank avatarId streak")
      .select("-password");

    if (!user) return res.status(404).json({ msg: "User not found." });

    // update streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastActive = user.streak.lastActiveDate
      ? new Date(user.streak.lastActiveDate)
      : null;

    if (lastActive) {
      lastActive.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        user.streak.current += 1;
        if (user.streak.current > user.streak.longest) {
          user.streak.longest = user.streak.current;
        }
      } else if (diffDays > 1) {
        user.streak.current = 1;
      }
    } else {
      user.streak.current = 1;
    }

    user.streak.lastActiveDate = new Date();
    await user.save();

    const quests = user.partyId
      ? await Quest.find({
          partyId: user.partyId,
          status: { $ne: "Completed" },
        })
          .populate("assignedTo", "username avatarId")
          .limit(5)
      : [];

    const notifications = await Notification.find({
      recipient: req.user,
    })
      .populate("fromUser", "username avatarId")
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      user: {
        id: user._id,
        username: user.username,
        rank: user.rank,
        avatarId: user.avatarId,
        bio: user.bio,
        points: user.points,
        totalPoints: user.totalPoints,
        badges: user.badges,
        streak: user.streak,
        neighbors: user.neighbors,
        isPartyOwner: user.isPartyOwner,
        // send saved position back to client on load
        plazaPosition: user.plazaPosition ?? { x: 0.5, y: 0.6 },
      },
      quests,
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// PATCH /api/dashboard/position
// debounced save of the character's plaza position
router.patch("/position", protect, async (req, res) => {
  try {
    const { x, y } = req.body;

    // basic sanity check — values must be normalised fractions
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      x < 0 ||
      x > 1 ||
      y < 0 ||
      y > 1
    ) {
      return res.status(400).json({ msg: "Invalid position values." });
    }

    await User.findByIdAndUpdate(req.user, {
      plazaPosition: { x, y },
    });

    res.json({ msg: "Position saved.", x, y });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// POST /api/dashboard/neighbor/request
router.post("/neighbor/request", protect, async (req, res) => {
  try {
    const { username } = req.body;
    const targetUser = await User.findOne({ username });

    if (!targetUser) return res.status(404).json({ msg: "User not found." });
    if (targetUser._id.toString() === req.user.toString())
      return res.status(400).json({ msg: "You can't add yourself." });

    const alreadyNeighbors = targetUser.neighbors.some(
      (n) => n.toString() === req.user.toString(),
    );
    if (alreadyNeighbors)
      return res.status(400).json({ msg: "Already neighbors!" });

    const alreadyRequested = targetUser.neighborRequests?.some(
      (r) => r.from.toString() === req.user.toString(),
    );
    if (alreadyRequested)
      return res.status(400).json({ msg: "Request already sent." });

    targetUser.neighborRequests = targetUser.neighborRequests ?? [];
    targetUser.neighborRequests.push({ from: req.user });
    await targetUser.save();

    const sender = await User.findById(req.user).select("username");
    await Notification.create({
      recipient: targetUser._id,
      type: "neighbor_request",
      message: `${sender.username} wants to be your neighbor! 🏡`,
      fromUser: req.user,
    });

    res.json({ msg: "Neighbor request sent!" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// POST /api/dashboard/neighbor/accept
router.post("/neighbor/accept", protect, async (req, res) => {
  try {
    const { fromUserId } = req.body;
    const currentUser = await User.findById(req.user);
    const fromUser = await User.findById(fromUserId);

    if (!fromUser) return res.status(404).json({ msg: "User not found." });

    currentUser.neighborRequests = currentUser.neighborRequests.filter(
      (r) => r.from.toString() !== fromUserId.toString(),
    );

    if (
      !currentUser.neighbors.some((n) => n.toString() === fromUserId.toString())
    ) {
      currentUser.neighbors.push(fromUserId);
    }
    if (!fromUser.neighbors.some((n) => n.toString() === req.user.toString())) {
      fromUser.neighbors.push(req.user);
    }

    await currentUser.save();
    await fromUser.save();

    await Notification.create({
      recipient: fromUserId,
      type: "neighbor_accepted",
      message: `${currentUser.username} accepted your neighbor request! 🌿`,
      fromUser: req.user,
    });

    res.json({ msg: "Neighbor added!" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// POST /api/dashboard/notifications/read
router.post("/notifications/read", protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user, read: false },
      { read: true },
    );
    res.json({ msg: "Notifications marked as read." });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// POST /api/dashboard/notifications/message
// send a direct message to a teammate (delivered as a notification)
router.post("/notifications/message", protect, async (req, res) => {
  try {
    const { recipientId, message } = req.body;

    if (!recipientId || !message?.trim())
      return res
        .status(400)
        .json({ msg: "Recipient and message are required." });

    const sender = await User.findById(req.user).select("username partyId");
    const recipient = await User.findById(recipientId).select("partyId");

    if (!recipient)
      return res.status(404).json({ msg: "Recipient not found." });

    // both must be in the same party
    if (
      !sender.partyId ||
      !recipient.partyId ||
      sender.partyId.toString() !== recipient.partyId.toString()
    )
      return res.status(403).json({ msg: "You can only message teammates." });

    await Notification.create({
      recipient: recipientId,
      type: "general",
      message: `💬 ${sender.username}: ${message.trim()}`,
      fromUser: req.user,
    });

    res.json({ msg: "Message sent!" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

export default router;
