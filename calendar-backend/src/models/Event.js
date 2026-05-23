const mongoose = require("mongoose");

// 日程分类
const CATEGORY_ENUM = ["work", "meeting", "outdoor", "vacation", "deadline", "personal"];

// 分类颜色映射
const CATEGORY_COLORS = {
  work: "#4A90E2",      // 蓝色 - 工作
  meeting: "#9B59B6",   // 紫色 - 会议
  outdoor: "#27AE60",   // 绿色 - 外勤
  vacation: "#F39C12",  // 橙色 - 休假
  deadline: "#E74C3C",  // 红色 - 截止
  personal: "#1ABC9C",  // 青色 - 个人
};

// 分类韩语名称
const CATEGORY_LABELS = {
  work: "작업",
  meeting: "회의",
  outdoor: "외근",
  vacation: "휴가",
  deadline: "마감",
  personal: "개인",
};

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
    
    // ===== 新增字段 =====
    
    // 分类标签
    category: {
      type: String,
      enum: CATEGORY_ENUM,
      default: "personal",
    },
    
    // 自定义标签
    tags: [{ type: String, trim: true }],
    
    // 地点
    location: { type: String, trim: true },
    
    // 提醒设置
    reminder: {
      enabled: { type: Boolean, default: false },
      minutes: { type: Number, default: 30 }, // 提前多少分钟
    },
    
    // 参与人列表
    attendees: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      status: { 
        type: String, 
        enum: ["pending", "accepted", "declined"],
        default: "pending",
      },
      respondedAt: { type: Date },
    }],
    
    // 通知记录
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

// 静态方法：获取分类配置
eventSchema.statics.CATEGORIES = CATEGORY_ENUM.map(cat => ({
  value: cat,
  label: CATEGORY_LABELS[cat],
  color: CATEGORY_COLORS[cat],
}));

eventSchema.statics.CATEGORY_COLORS = CATEGORY_COLORS;
eventSchema.statics.CATEGORY_LABELS = CATEGORY_LABELS;

// 获取日程颜色
eventSchema.methods.getColor = function () {
  return CATEGORY_COLORS[this.category] || "#4A90E2";
};

module.exports = mongoose.model("Event", eventSchema);
