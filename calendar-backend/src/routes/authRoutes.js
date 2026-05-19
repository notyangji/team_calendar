const express = require("express");
const router = express.Router();
const { register, login, getMe, googleLogin, kakaoLogin, googleCallback, kakaoCallback, oauthRegister } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.post("/google", googleLogin);
router.post("/kakao", kakaoLogin);
router.get("/google/callback", googleCallback);
router.get("/kakao/callback", kakaoCallback);
router.post("/oauth-register", oauthRegister);

module.exports = router;
