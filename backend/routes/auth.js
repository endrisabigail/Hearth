import express from "express";
import User from "../models/user.js";
import Party from "../models/party.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// POST /api/auth/register
// called from the frontend right after a successful Firebase signup
// creates the matching Mongo profile (firebase already handled the credentials)
router.post("/register", protect, async (req, res) => {
  try {
    const { username, inviteCode } = req.body;

    const existing = await User.findOne({ firebaseUid: req.firebaseUid });
    if (existing)
      return res.status(400).json({ msg: "Profile already exists for this account." });

    const usernameExists = await User.findOne({ username });
    if (usernameExists)
      return res.status(400).json({ msg: "This username is already taken." });

    const user = new User({
      username,
      email: req.firebaseEmail,
      firebaseUid: req.firebaseUid,
      rank: "Fledgling",
    });

    await user.save();

    if (!inviteCode) {
      const party = new Party({
        name: `${username}'s Hearth`,
        owner: user._id,
        members: [],
      });
      await party.save();

      user.partyId = party._id;
      user.isPartyOwner = true;
      await user.save();
    }

    res.status(201).json({
      user: {
        id: user._id,
        username: user.username,
        rank: user.rank,
        avatarId: user.avatarId,
        partyId: user.partyId,
        isPartyOwner: user.isPartyOwner,
      },
    });
  } catch (err) {
    console.error("FULL ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});

// POST /api/auth/update-avatar
router.post("/update-avatar", protect, async (req, res) => {
  try {
    const { avatarId } = req.body;

    const validAvatars = [
      "tomato",
      "frog",
      "fish",
      "mushroom",
      "apple",
      "snail",
    ];
    if (!validAvatars.includes(avatarId))
      return res.status(400).json({ msg: "Invalid avatar selection." });

    const user = await User.findByIdAndUpdate(
      req.user,
      { avatarId },
      { new: true },
    );

    res.json({ msg: "Avatar updated!", avatarId: user.avatarId });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;