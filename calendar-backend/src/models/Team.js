const mongoose = require("mongoose");

const ROLE_ENUM = ["owner", "admin", "member", "guest"];

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // 角色分级: owner > admin > member > guest
    memberRoles: {
      type: Map,
      of: {
        type: String,
        enum: ROLE_ENUM,
        default: "member",
      },
    },
    inviteCode: { type: String, unique: true },
  },
  { timestamps: true }
);

// 预设分类
teamSchema.statics.ROLE_ENUM = ROLE_ENUM;

// 获取用户在团队中的角色
teamSchema.methods.getUserRole = function (userId) {
  const userIdStr = userId.toString();
  if (this.owner.toString() === userIdStr) return "owner";
  const role = this.memberRoles?.get(userIdStr);
  if (role) return role;
  if (this.members.some((m) => m.toString() === userIdStr)) return "member";
  return null;
};

// 检查用户是否有某权限
teamSchema.methods.hasPermission = function (userId, action) {
  const role = this.getUserRole(userId);
  if (!role) return false;

  const permissions = {
    owner: ["all"],
    admin: ["view", "edit_event", "manage_members", "invite", "share_event"],
    member: ["view", "create_event", "edit_own_event", "share_own_event"],
    guest: ["view"],
  };

  const allowed = permissions[role] || [];
  return allowed.includes("all") || allowed.includes(action);
};

// 角色等级
teamSchema.statics.ROLE_LEVELS = {
  owner: 4,
  admin: 3,
  member: 2,
  guest: 1,
};

module.exports = mongoose.model("Team", teamSchema);
