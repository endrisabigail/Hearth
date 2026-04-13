import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const PartySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "My Party",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    inviteCode: {
      type: String,
      unique: true,
      default: () => uuidv4().slice(0, 8), // short unique code e.g. "a1b2c3d4"
    },
    mapTheme: {
      type: String,
      default: "default",
    },
  },
  { timestamps: true },
);

export default mongoose.model("Party", PartySchema);
