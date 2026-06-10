const mongoose = require("mongoose");

// 일정 분류
const CATEGORY_ENUM = ["work", "meeting", "outdoor", "vacation", "deadline", "personal"];

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    sourceTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    
    // 분류
    category: {
      type: String,
      enum: CATEGORY_ENUM,
      default: "personal",
    },
    
    // 태그
    tags: [{ type: String, trim: true }],

    // 장소
    location: { type: String, trim: true },

    // 알림 설정
    reminder: {
      enabled: { type: Boolean, default: false },
      minutes: { type: Number, default: 30 }, // 몇 분 전 알림
    },

    // 참여자 목록
    attendees: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      status: { 
        type: String, 
        enum: ["pending", "accepted", "declined"],
        default: "pending",
      },
      respondedAt: { type: Date },
    }],
    
    // 알림 기록
    notifications: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      type: { type: String, enum: ["created", "updated", "deleted", "reminder"] },
      message: { type: String },
      isRead: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
