const crypto = require("crypto");
const Team = require("../models/Team");
const User = require("../models/User");

const generateInviteCode = () => crypto.randomBytes(4).toString("hex");

const createTeam = async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: "팀 이름을 입력해주세요." });

  const team = await Team.create({
    name,
    description,
    owner: req.user._id,
    members: [req.user._id],
    inviteCode: generateInviteCode(),
    memberRoles: { [req.user._id.toString()]: "owner" },
  });

  await User.findByIdAndUpdate(req.user._id, { $push: { teams: team._id } });
  res.status(201).json(team);
};

const getMyTeams = async (req, res) => {
  const teams = await Team.find({ members: req.user._id }).populate("owner", "name email");
  res.json(teams);
};

const getTeam = async (req, res) => {
  const team = await Team.findById(req.params.id)
    .populate("owner", "name email")
    .populate("members", "name email");
  if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });
  res.json(team);
};

// 获取成员列表（含角色）
const getMembers = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id).populate("owner", "name email");
    if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });
    
    // 检查用户是否是团队成员
    if (!team.members.some(m => m._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: "팀 멤버만 조회할 수 있습니다." });
    }

    // 获取所有成员信息
    const memberIds = team.members.map(m => m._id || m);
    const users = await User.find({ _id: { $in: memberIds } }).select("_id name email");
    
    const members = users.map(user => {
      let role = "member"; // 默认角色
      if (team.owner.toString() === user._id.toString()) {
        role = "owner";
      } else {
        role = team.memberRoles?.get(user._id.toString()) || "member";
      }
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role,
      };
    });

    // 按角色分组
    const grouped = {
      owner: members.filter(m => m.role === "owner"),
      admins: members.filter(m => m.role === "admin"),
      members: members.filter(m => m.role === "member"),
      guests: members.filter(m => m.role === "guest"),
    };

    res.json({
      teamId: team._id,
      teamName: team.name,
      ...grouped,
      all: members,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 获取我的角色
const getMyRole = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });
    
    const role = team.getUserRole(req.user._id);
    if (!role) return res.status(403).json({ message: "팀 멤버가 아닙니다." });
    
    res.json({ role, permissions: getPermissionsByRole(role) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 根据角色获取权限列表
const getPermissionsByRole = (role) => {
  const permissions = {
    owner: ["view", "edit_event", "create_event", "delete_event", "manage_members", "invite", "share_event", "change_role"],
    admin: ["view", "edit_event", "create_event", "delete_event", "manage_members", "invite", "share_event"],
    member: ["view", "create_event", "edit_own_event", "share_own_event"],
    guest: ["view"],
  };
  return permissions[role] || [];
};

// 修改成员角色
const updateMemberRole = async (req, res) => {
  try {
    const { id: teamId, userId } = req.params;
    const { role } = req.body;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });

    // 检查权限：只有 owner 可以修改角色
    const myRole = team.getUserRole(req.user._id);
    if (myRole !== "owner") {
      return res.status(403).json({ message: "팀장만 역할을 변경할 수 있습니다." });
    }

    // 不能修改自己的角色
    if (userId === team.owner.toString()) {
      return res.status(400).json({ message: "팀장의 역할은 변경할 수 없습니다." });
    }

    // 验证角色值
    if (!Team.ROLE_ENUM.includes(role)) {
      return res.status(400).json({ message: "유효하지 않은 역할입니다." });
    }

    // 更新角色
    if (!team.memberRoles) {
      team.memberRoles = new Map();
    }
    team.memberRoles.set(userId, role);
    await team.save();

    res.json({ message: "역할이 변경되었습니다.", role });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//  초대 URL 조회
const getInviteLink = async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });
  if (!team.members.includes(req.user._id))
    return res.status(403).json({ message: "팀 멤버만 초대 링크를 조회할 수 있습니다." });

  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  res.json({
    inviteCode: team.inviteCode,
    inviteUrl: `${baseUrl}/join/${team.inviteCode}`,
  });
};

// 초대 코드로 팀 참가 (코드 입력)
const joinTeam = async (req, res) => {
  const inviteCode = req.body.inviteCode || req.params.inviteCode;
  if (!inviteCode) return res.status(400).json({ message: "초대 코드를 입력해주세요." });

  const team = await Team.findOne({ inviteCode })
    .populate("owner", "name email")
    .populate("members", "name email");
  if (!team) return res.status(404).json({ message: "유효하지 않은 초대 코드입니다." });

  if (team.members.some((m) => m._id.toString() === req.user._id.toString()))
    return res.status(409).json({ message: "이미 팀에 속해 있습니다." });

  team.members.push(req.user._id);
  // 新成员默认为 member 角色
  if (!team.memberRoles) {
    team.memberRoles = new Map();
  }
  team.memberRoles.set(req.user._id.toString(), "member");
  await team.save();
  await User.findByIdAndUpdate(req.user._id, { $push: { teams: team._id } });

  res.json(team);
};

// 초대 코드 재생성 (팀장만)
const regenerateInvite = async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });
  if (team.owner.toString() !== req.user._id.toString())
    return res.status(403).json({ message: "팀장만 초대 코드를 재생성할 수 있습니다." });

  team.inviteCode = generateInviteCode();
  await team.save();

  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  res.json({
    inviteCode: team.inviteCode,
    inviteUrl: `${baseUrl}/join/${team.inviteCode}`,
  });
};

// 팀 나가기
const leaveTeam = async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });

  if (team.owner.toString() === req.user._id.toString())
    return res.status(400).json({ message: "팀장은 팀을 나갈 수 없습니다. 팀을 삭제하거나 팀장을 양도해주세요." });

  if (!team.members.some(m => m.toString() === req.user._id.toString()))
    return res.status(400).json({ message: "팀 멤버가 아닙니다." });

  team.members = team.members.filter((m) => m.toString() !== req.user._id.toString());
  // 清除角色记录
  if (team.memberRoles) {
    team.memberRoles.delete(req.user._id.toString());
  }
  await team.save();
  await User.findByIdAndUpdate(req.user._id, { $pull: { teams: team._id } });

  res.json({ message: "팀을 나갔습니다." });
};

// 멤버 강퇴 (팀장만)
const removeMember = async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });
  if (team.owner.toString() !== req.user._id.toString())
    return res.status(403).json({ message: "팀장만 멤버를 강퇴할 수 있습니다." });

  const { userId } = req.params;
  if (userId === team.owner.toString())
    return res.status(400).json({ message: "팀장은 강퇴할 수 없습니다." });

  team.members = team.members.filter((m) => m.toString() !== userId);
  if (team.memberRoles) {
    team.memberRoles.delete(userId);
  }
  await team.save();
  await User.findByIdAndUpdate(userId, { $pull: { teams: team._id } });

  res.json({ message: "멤버를 강퇴했습니다." });
};

const deleteTeam = async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });
  if (team.owner.toString() !== req.user._id.toString())
    return res.status(403).json({ message: "팀 소유자만 삭제할 수 있습니다." });

  await User.updateMany({ teams: team._id }, { $pull: { teams: team._id } });
  await team.deleteOne();
  res.json({ message: "팀이 삭제되었습니다." });
};

module.exports = {
  createTeam,
  getMyTeams,
  getTeam,
  getMembers,
  getMyRole,
  updateMemberRole,
  getInviteLink,
  joinTeam,
  regenerateInvite,
  leaveTeam,
  removeMember,
  deleteTeam,
};
