const express = require("express");
const router = express.Router();
const {
  createTeam,
  getMyTeams,
  getTeam,
  getInviteLink,
  joinTeam,
  regenerateInvite,
  leaveTeam,
  removeMember,
  deleteTeam,
} = require("../controllers/teamController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.get("/", getMyTeams);
router.post("/", createTeam);

router.post("/join", joinTeam);               // 초대 코드 입력으로 참가
router.get("/join/:inviteCode", joinTeam);    // 초대 URL 클릭으로 참가

router.get("/:id", getTeam);
router.delete("/:id", deleteTeam);
router.post("/:id/leave", leaveTeam);                        // 팀 나가기
router.get("/:id/invite", getInviteLink);                    // 초대 링크 조회
router.post("/:id/invite/regenerate", regenerateInvite);     // 초대 코드 재생성
router.delete("/:id/members/:userId", removeMember);         // 멤버 강퇴

module.exports = router;
