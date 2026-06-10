const express = require("express");
const router = express.Router();
const { register, login, getMe, updateProfile, googleCallback, kakaoCallback, oauthRegister } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.put("/me", protect, updateProfile);
router.get("/google/callback", googleCallback);
router.get("/kakao/callback", kakaoCallback);
router.post("/oauth-register", oauthRegister);

module.exports = router;
