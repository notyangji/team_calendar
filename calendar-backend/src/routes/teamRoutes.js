const express = require("express");
const router = express.Router();
const {
  createTeam,
  getMyTeams,
  getTeam,
  updateMemberRole,
  getInviteLink,
  joinTeam,
  regenerateInvite,
  leaveTeam,
  removeMember,
  deleteTeam,
} = require("../controllers/teamController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

// 团队管理
router.post("/", createTeam);
router.get("/", getMyTeams);
router.get("/:id", getTeam);
router.delete("/:id", deleteTeam);

// 멤버 관리
router.post("/member-role", updateMemberRole);

// 초대
router.get("/:id/invite", getInviteLink);
router.post("/join", joinTeam);
router.post("/join/:inviteCode", joinTeam);
router.put("/:id/regenerate-invite", regenerateInvite);

// 成员操作
router.post("/:id/leave", leaveTeam);
router.delete("/:id/members/:userId", removeMember);

module.exports = router;
