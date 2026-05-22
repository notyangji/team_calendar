const express = require("express");
const router = express.Router();
const { 
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
} = require("../controllers/teamController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

// 团队管理
router.post("/", createTeam);
router.get("/", getMyTeams);
router.get("/:id", getTeam);
router.delete("/:id", deleteTeam);

// 成员管理
router.get("/:id/members", getMembers);
router.get("/:id/my-role", getMyRole);
router.put("/:id/members/:userId/role", updateMemberRole);

// 邀请
router.get("/:id/invite", getInviteLink);
router.post("/join", joinTeam);
router.post("/join/:inviteCode", joinTeam);
router.put("/:id/regenerate-invite", regenerateInvite);

// 成员操作
router.post("/:id/leave", leaveTeam);
router.delete("/:id/members/:userId", removeMember);

module.exports = router;
