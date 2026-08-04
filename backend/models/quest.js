import mongoose from "mongoose";

const QuestSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    category: {
      type: String,
      default: "general",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    tags: {
      type: [String],
      default: [],
    },
    points: {
      type: Number,
      default: 5,
    },
    status: {
      type: String,
      enum: ["Not Started", "In Progress", "Completed"],
      default: "Not Started",
    },
    checklist: {
      type: [
        {
          text: { type: String, required: true },
          done: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    comments: {
      type: [
        {
          text: { type: String, required: true },
          author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    attachments: {
      type: [
        {
          filename: String,
          url: String,
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    editHistory: {
      type: [
        {
          field: String,
          oldValue: mongoose.Schema.Types.Mixed,
          newValue: mongoose.Schema.Types.Mixed,
          editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          editedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    // which party this quest belongs to
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
      required: true,
    },
    // who created it (the lead)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // who is assigned to it
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // who completed it
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    aiBreakdown: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Quest", QuestSchema);