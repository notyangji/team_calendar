const jwt = require("jsonwebtoken");
const User = require("../models/User");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const formatUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  weeklyFreeTime: user.weeklyFreeTime || [],
  token: generateToken(user._id),
});

const register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "모든 필드를 입력해주세요." });

  const existing = await User.findOne({ email });
  if (existing)
    return res.status(409).json({ message: "이미 사용 중인 이메일입니다." });

  const user = await User.create({ name, email, password });
  res.status(201).json(formatUser(user));
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "이메일과 비밀번호를 입력해주세요." });

  const user = await User.findOne({ email });
  if (!user || !user.password || !(await user.comparePassword(password)))
    return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });

  res.json(formatUser(user));
};

const getMe = async (req, res) => {
  res.json(req.user);
};

const updateProfile = async (req, res) => {
  try {
    const { name, weeklyFreeTime } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });

    if (typeof name === "string") {
      const trimmed = name.trim();
      if (!trimmed) return res.status(400).json({ message: "이름을 입력해주세요." });
      user.name = trimmed;
    }

    if (Array.isArray(weeklyFreeTime)) {
      const valid = weeklyFreeTime
        .filter(s =>
          s && Number.isInteger(s.day) && s.day >= 0 && s.day <= 6 &&
          /^\d{2}:\d{2}$/.test(s.start) && /^\d{2}:\d{2}$/.test(s.end) && s.start < s.end
        )
        .map(s => ({ day: s.day, start: s.start, end: s.end }));
      user.weeklyFreeTime = valid;
    }

    await user.save();
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      weeklyFreeTime: user.weeklyFreeTime,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Google 로그인 — 인가 코드를 받아 토큰 교환 후 유저 정보 조회
const googleLogin = async (req, res) => {
  const { code, redirectUri } = req.body;
  if (!code) return res.status(400).json({ message: "인가 코드가 없습니다." });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token)
    return res.status(401).json({ message: "구글 인증에 실패했습니다." });

  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const googleUser = await userRes.json();
  if (!googleUser.sub)
    return res.status(401).json({ message: "구글 유저 정보를 가져올 수 없습니다." });

  let user = await User.findOne({ googleId: googleUser.sub });
  if (!user) user = await User.findOne({ email: googleUser.email });
  if (!user) {
    user = await User.create({
      name: googleUser.name,
      email: googleUser.email,
      googleId: googleUser.sub,
    });
  } else if (!user.googleId) {
    user.googleId = googleUser.sub;
    await user.save();
  }

  res.json(formatUser(user));
};

// 카카오 로그인 — 프론트에서 받은 인가코드로 토큰 교환 후 유저 정보 조회
const kakaoLogin = async (req, res) => {
  const { code, redirectUri } = req.body;
  if (!code)
    return res.status(400).json({ message: "인가 코드가 없습니다." });

  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.KAKAO_REST_API_KEY,
      redirect_uri: redirectUri,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token)
    return res.status(401).json({ message: "카카오 인증에 실패했습니다." });

  const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const kakaoUser = await userRes.json();

  const kakaoId = String(kakaoUser.id);
  const email = kakaoUser.kakao_account?.email;
  const name = kakaoUser.kakao_account?.profile?.nickname || "카카오 사용자";

  let user = await User.findOne({ kakaoId });
  if (!user && email) user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name,
      email: email || `kakao_${kakaoId}@kakao.placeholder`,
      kakaoId,
    });
  } else if (!user.kakaoId) {
    user.kakaoId = kakaoId;
    await user.save();
  }

  res.json(formatUser(user));
};

// Google OAuth 브라우저 콜백 — 코드 교환 후 앱으로 토큰 전달
const googleCallback = async (req, res) => {
  const { code, state } = req.query;
  const appReturnUri = decodeURIComponent(state);
  const callbackUri = `${process.env.BACKEND_URL}/api/auth/google/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("token_exchange_failed");

    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json();
    if (!googleUser.sub) throw new Error("user_info_failed");

    let user = await User.findOne({ googleId: googleUser.sub });
    if (!user) user = await User.findOne({ email: googleUser.email });

    if (!user) {
      return res.redirect(
        `${appReturnUri}?email=${encodeURIComponent(googleUser.email)}&oauthId=${encodeURIComponent(googleUser.sub)}&provider=google`
      );
    }

    if (!user.googleId) { user.googleId = googleUser.sub; await user.save(); }
    const token = generateToken(user._id);
    res.redirect(`${appReturnUri}?token=${token}`);
  } catch (e) {
    res.redirect(`${appReturnUri}?error=${e.message}`);
  }
};

// 카카오 OAuth 브라우저 콜백 — 코드 교환 후 앱으로 토큰 전달
const kakaoCallback = async (req, res) => {
  const { code, state } = req.query;
  const appReturnUri = decodeURIComponent(state);
  const callbackUri = `${process.env.BACKEND_URL}/api/auth/kakao/callback`;
  console.log("[Kakao CB] code:", !!code, "state:", !!state, "appReturnUri:", appReturnUri?.slice(0, 30));

  try {
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.KAKAO_REST_API_KEY,
        redirect_uri: callbackUri,
        code,
        ...(process.env.KAKAO_CLIENT_SECRET && { client_secret: process.env.KAKAO_CLIENT_SECRET }),
      }),
    });
    const tokenData = await tokenRes.json();
    console.log("[Kakao CB] token result:", tokenData.access_token ? "OK" : tokenData.error_code, tokenData.error_description || "");
    if (!tokenData.access_token) throw new Error(tokenData.error_code || "token_exchange_failed");

    const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const kakaoUser = await userRes.json();

    const kakaoId = String(kakaoUser.id);
    const email = kakaoUser.kakao_account?.email;

    let user = await User.findOne({ kakaoId });
    if (!user && email) user = await User.findOne({ email });

    if (!user) {
      return res.redirect(
        `${appReturnUri}?email=${encodeURIComponent(email || "")}&oauthId=${encodeURIComponent(kakaoId)}&provider=kakao`
      );
    }

    if (!user.kakaoId) { user.kakaoId = kakaoId; await user.save(); }
    const token = generateToken(user._id);
    res.redirect(`${appReturnUri}?token=${token}`);
  } catch (e) {
    res.redirect(`${appReturnUri}?error=${e.message}`);
  }
};

const oauthRegister = async (req, res) => {
  const { name, email, oauthId, provider } = req.body;
  if (!name?.trim() || !oauthId || !provider)
    return res.status(400).json({ message: "이름과 소셜 정보가 필요합니다." });

  const idQuery = provider === "google" ? { googleId: oauthId } : { kakaoId: oauthId };
  let user = await User.findOne(idQuery);
  if (!user && email) user = await User.findOne({ email });

  if (user) {
    if (provider === "google" && !user.googleId) { user.googleId = oauthId; await user.save(); }
    if (provider === "kakao" && !user.kakaoId) { user.kakaoId = oauthId; await user.save(); }
    return res.json(formatUser(user));
  }

  const userData = {
    name: name.trim(),
    email: email || `${provider}_${oauthId}@oauth.placeholder`,
    ...(provider === "google" && { googleId: oauthId }),
    ...(provider === "kakao" && { kakaoId: oauthId }),
  };
  user = await User.create(userData);
  res.status(201).json(formatUser(user));
};

module.exports = { register, login, getMe, updateProfile, googleLogin, kakaoLogin, googleCallback, kakaoCallback, oauthRegister };
