const mongoose = require("mongoose");

const ROLE_ENUM = ["owner", "admin", "member", "guest"];

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // 역할 등급: owner > admin > member > guest
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

// 팀 내 사용자 역할 조회
teamSchema.methods.getUserRole = function (userId) {
  const userIdStr = userId.toString();
  if (this.owner.toString() === userIdStr) return "owner";
  const role = this.memberRoles?.get(userIdStr);
  if (role) return role;
  if (this.members.some((m) => m.toString() === userIdStr)) return "member";
  return null;
};

module.exports = mongoose.model("Team", teamSchema);
