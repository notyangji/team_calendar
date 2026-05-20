const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    sourceTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    isPublic: { type: Boolean, default: false },
    appliedTeams: [{ type: mongoose.Schema.Types.ObjectId, ref: "Team" }],
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
