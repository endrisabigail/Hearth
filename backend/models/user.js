import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    avatarId: {
      type: String,
      default: "frog",
    },
    rank: {
      type: String,
      default: "Fledgling",
    },
    bio: {
      type: String,
      default: "",
    },
    points: {
      type: Map,
      of: Number,
      default: {},
    },
    totalPoints: {
      type: Number,
      default: 0,
    },
    badges: [
      {
        badgeName: String,
        badgeDescription: String,
        badgeImage: String,
        earnedAt: { type: Date, default: Date.now },
      },
    ],
    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastActiveDate: { type: Date, default: null },
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
      default: null,
    },
    isPartyOwner: {
      type: Boolean,
      default: false,
    },
    neighbors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    neighborRequests: [
      {
        from: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    // persisted plaza position
    plazaPosition: {
      x: { type: Number, default: 0.5 },
      y: { type: Number, default: 0.6 },
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", UserSchema);
