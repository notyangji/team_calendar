const express = require("express");
const router = express.Router();
const { createEvent, getEvents, getEvent, updateEvent, deleteEvent, publishEvents } = require("../controllers/eventController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.get("/", getEvents);
router.post("/", createEvent);
router.put("/publish", publishEvents);
router.get("/:id", getEvent);
router.put("/:id", updateEvent);
router.delete("/:id", deleteEvent);

module.exports = router;
