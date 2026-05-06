import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/user.js";
import Party from "../models/party.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, inviteCode } = req.body;

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

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.status(201).json({ token });
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
    ).select("-password");

    res.json({ msg: "Avatar updated!", avatarId: user.avatarId });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "User not found" });

    const token = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "🌿 reset your hearth password ♪",
      html: `
        <div style="
          background-color: #f5f0e8;
          font-family: Georgia, serif;
          max-width: 480px;
          margin: 0 auto;
          border-radius: 16px;
          overflow: hidden;
          border: 2px solid #c8dfc8;
        ">
          <div style="
            background-color: #5aaa78;
            padding: 28px;
            text-align: center;
          ">
            <div style="font-size: 36px;">🌱</div>
            <div style="
              color: white;
              font-size: 22px;
              letter-spacing: 3px;
              margin-top: 6px;
            ">HEARTH</div>
          </div>

          <div style="padding: 32px 36px; color: #4a5e4a;">
            <p style="font-size: 18px; margin: 0 0 8px;">hi ${user.username} ♡</p>
            <p style="color: #7a9a7a; margin: 0 0 24px; font-size: 14px;">
              we got a request to reset your password. no worries — it happens to the best of us! 🍄
            </p>

            <div style="text-align: center; margin: 28px 0;">
              <a href="${process.env.CLIENT_URL}/reset-password/${token}" style="
                background-color: #5aaa78;
                color: white;
                padding: 14px 32px;
                border-radius: 999px;
                text-decoration: none;
                font-size: 15px;
                letter-spacing: 1px;
              ">reset my password ✦</a>
            </div>

            <p style="font-size: 12px; color: #a0b8a0; text-align: center; margin: 0 0 8px;">
              this link expires in 1 hour 🕐
            </p>
            <p style="font-size: 12px; color: #a0b8a0; text-align: center; margin: 0;">
              if you didn't ask for this, you can safely ignore this email ✨
            </p>
          </div>

          <div style="
            border-top: 1px solid #c8dfc8;
            padding: 16px;
            text-align: center;
            color: #a0b8a0;
            font-size: 11px;
          ">
            🌿 hearth &nbsp;·&nbsp; sent with care ♪
          </div>
        </div>
      `,
    });

    res.json({ msg: "Email sent!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/auth/reset-password/:token
router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ msg: "Invalid or expired token" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ msg: "Password reset successful! You can now log in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;
