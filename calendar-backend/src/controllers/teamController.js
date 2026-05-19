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

// 초대 URL 조회
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

  if (!team.members.includes(req.user._id))
    return res.status(400).json({ message: "팀 멤버가 아닙니다." });

  team.members = team.members.filter((m) => m.toString() !== req.user._id.toString());
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
  getInviteLink,
  joinTeam,
  regenerateInvite,
  leaveTeam,
  removeMember,
  deleteTeam,
};
