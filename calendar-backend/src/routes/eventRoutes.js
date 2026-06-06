const express = require("express");
const router = express.Router();
const { 
  createEvent, 
  getEvents, 
  getEvent, 
  updateEvent, 
  deleteEvent, 
  publishEvents,
  getTeamEvents,
  addAttendees,
  removeAttendee,
  updateAttendeeStatus,
  getNotifications,
  markNotificationRead,
  getCategories,
  getFreeBusy,
} = require("../controllers/eventController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

// 고정 경로는 반드시 /:id 앞에 선언 (Express 라우트 순서 규칙)
router.get("/", getEvents);
router.post("/", createEvent);
router.get("/categories", getCategories);
router.get("/notifications", getNotifications);
router.put("/publish", publishEvents);
router.get("/team/:teamId", getTeamEvents);
router.get("/free-busy", getFreeBusy);

router.get("/:id", getEvent);
router.put("/:id", updateEvent);
router.delete("/:id", deleteEvent);

// 参与人管理
router.post("/:id/attendees", addAttendees);
router.delete("/:id/attendees/:userId", removeAttendee);
router.put("/:id/attendees/:userId/status", updateAttendeeStatus);

// 通知管理
router.put("/:eventId/notifications/:notificationId/read", markNotificationRead);

module.exports = router;
