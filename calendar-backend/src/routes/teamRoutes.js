const express = require("express");
const router = express.Router();
const { createTeam, getMyTeams, getTeam, joinTeam, deleteTeam } = require("../controllers/teamController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.get("/", getMyTeams);
router.post("/", createTeam);
router.get("/:id", getTeam);
router.post("/join", joinTeam);
router.delete("/:id", deleteTeam);

module.exports = router;
