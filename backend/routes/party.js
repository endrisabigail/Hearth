import express from "express";
import Party from "../models/party.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// POST /api/party/create
// lead creates a new party (called automatically after signup)
router.post("/create", protect, async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.findById(req.user);

    if (!user) return res.status(404).json({ msg: "User not found." });
    if (user.partyId)
      return res.status(400).json({ msg: "You already have a party." });

    const party = new Party({
      name: name || `${user.username}'s Hearth`,
      owner: req.user,
      members: [],
    });

    await party.save();

    // link party to user
    user.partyId = party._id;
    user.isPartyOwner = true;
    await user.save();

    res.status(201).json({
      party,
      inviteLink: `/join/${party.inviteCode}`,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// GET /api/party/invite/:inviteCode
// get party info from invite code (shown on join page before confirming)
router.get("/invite/:inviteCode", async (req, res) => {
  try {
    const party = await Party.findOne({ inviteCode: req.params.inviteCode })
      .populate("owner", "username avatarId rank")
      .populate("members", "username avatarId rank");

    if (!party) return res.status(404).json({ msg: "Party not found." });

    res.json({
      partyName: party.name,
      owner: party.owner,
      memberCount: party.members.length,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// POST /api/party/join/:inviteCode
// member joins a party via invite link
router.post("/join/:inviteCode", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    if (!user) return res.status(404).json({ msg: "User not found." });

    if (user.partyId)
      return res.status(400).json({ msg: "You are already in a party." });

    const party = await Party.findOne({ inviteCode: req.params.inviteCode });
    if (!party)
      return res
        .status(404)
        .json({ msg: "Party not found. Check your invite link!" });

    // add user to party members (ObjectId-safe comparison)
    const alreadyMember = party.members.some(
      (m) => m.toString() === req.user.toString(),
    );
    if (!alreadyMember) {
      party.members.push(req.user);
    }
    await party.save();

    // link party to user
    user.partyId = party._id;
    user.isPartyOwner = false;
    await user.save();

    // notify the party owner
    await Notification.create({
      recipient: party.owner,
      type: "member_joined",
      message: `${user.username} joined your Hearth! 🏡`,
      fromUser: req.user,
    });

    res.json({ msg: "Joined party!", partyId: party._id });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// GET /api/party
// get the current user's party
router.get("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    if (!user?.partyId)
      return res.status(404).json({ msg: "You are not in a party yet." });

    const party = await Party.findById(user.partyId)
      .populate("owner", "username avatarId rank streak")
      .populate("members", "username avatarId rank streak");

    if (!party) return res.status(404).json({ msg: "Party not found." });

    res.json(party);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

export default router;
