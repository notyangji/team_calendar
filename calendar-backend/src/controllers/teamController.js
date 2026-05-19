const crypto = require("crypto");
const Team = require("../models/Team");
const User = require("../models/User");

const createTeam = async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: "팀 이름을 입력해주세요." });

  const inviteCode = crypto.randomBytes(4).toString("hex");
  const team = await Team.create({
    name,
    description,
    owner: req.user._id,
    members: [req.user._id],
    inviteCode,
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

const joinTeam = async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) return res.status(400).json({ message: "초대 코드를 입력해주세요." });

  const team = await Team.findOne({ inviteCode });
  if (!team) return res.status(404).json({ message: "유효하지 않은 초대 코드입니다." });

  if (team.members.includes(req.user._id))
    return res.status(409).json({ message: "이미 팀에 속해 있습니다." });

  team.members.push(req.user._id);
  await team.save();
  await User.findByIdAndUpdate(req.user._id, { $push: { teams: team._id } });

  res.json(team);
};

const deleteTeam = async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });
  if (team.owner.toString() !== req.user._id.toString())
    return res.status(403).json({ message: "팀 소유자만 삭제할 수 있습니다." });

  await team.deleteOne();
  res.json({ message: "팀이 삭제되었습니다." });
};

module.exports = { createTeam, getMyTeams, getTeam, joinTeam, deleteTeam };
