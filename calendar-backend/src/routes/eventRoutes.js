const express = require("express");
const router = express.Router();
const {
  createEvent,
  getEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  getNotifications,
  markNotificationRead,
  getFreeBusy,
} = require("../controllers/eventController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

// 고정 경로는 반드시 /:id 앞에 선언 (Express 라우트 순서 규칙)
router.get("/", getEvents);
router.post("/", createEvent);
router.get("/notifications", getNotifications);
router.get("/free-busy", getFreeBusy);

router.get("/:id", getEvent);
router.put("/:id", updateEvent);
router.delete("/:id", deleteEvent);

// 알림 관리
router.put("/:eventId/notifications/:notificationId/read", markNotificationRead);

module.exports = router;
