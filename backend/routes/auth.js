import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Party from "../models/party.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const emailExists = await User.findOne({ email });
    if (emailExists)
      return res.status(400).json({ msg: "This email is already registered." });

    const usernameExists = await User.findOne({ username });
    if (usernameExists)
      return res.status(400).json({ msg: "This username is already taken." });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      username,
      email,
      password: hashedPassword,
      rank: "Fledgling",
    });

    await user.save();

    // automatically create a party for the new user
    const party = new Party({
      name: `${username}'s Hearth`,
      owner: user._id,
      members: [],
    });
    await party.save();

    // link party to user
    user.partyId = party._id;
    user.isPartyOwner = true;
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.status(201).json({
      token,
      inviteCode: party.inviteCode,
    });
  } catch (err) {
    console.error("FULL ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Invalid credentials." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials." });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({
      token,
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
    console.error(err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/auth/update-avatar
router.post("/update-avatar", protect, async (req, res) => {
  try {
    const { avatarId } = req.body;

    const validAvatars = ["tomato", "frog", "fish", "mushroom", "apple", "snail"];
    if (!validAvatars.includes(avatarId))
      return res.status(400).json({ msg: "Invalid avatar selection." });

    const user = await User.findByIdAndUpdate(
      req.user,
      { avatarId },
      { new: true },
    ).select("-password");

    res.json({ msg: "Avatar updated!", avatarId: user.avatarId });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;
