import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { SafeAreaView } from "react-native-safe-area-context";
import client, { BACKEND_URL } from "../api/client";
import { useAuth } from "../context/AuthContext";

WebBrowser.maybeCompleteAuthSession();

// Google Cloud Console → 사용자 인증 정보 → OAuth 클라이언트 ID (웹 애플리케이션)
const GOOGLE_CLIENT_ID = "302079810578-da87bmh36kr4e181fsmoqvmfk1nttndf.apps.googleusercontent.com";

// 카카오 개발자 콘솔에서 발급받은 REST API 키
const KAKAO_REST_API_KEY = "27f4d03c4859f152d77f7a31037991a6";

// ngrok URL — OAuth 콜백용 (Google/카카오 콘솔에 등록한 주소와 동일해야 함)
const OAUTH_BASE_URL = "https://drew-evict-duchess.ngrok-free.dev";

export default function LoginScreen({ navigation }) {
  const { login, loginWithOAuth } = useAuth();
  const goToMain = () => navigation.replace("Main");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert("알림", "이메일과 비밀번호를 입력해주세요.");
    setLoading(true);
    try {
      await login(email, password);
      goToMain();
    } catch (e) {
      Alert.alert("로그인 실패", e.response?.data?.message || "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthResult = async (result, provider) => {
    console.log(`[${provider}] result.type:`, result.type, "url:", result.url);
    if (result.type !== "success") {
      Alert.alert(`${provider}`, `결과: ${result.type}`);
      return;
    }
    const url = new URL(result.url);
    const token = url.searchParams.get("token");
    const error = url.searchParams.get("error");
    const email = url.searchParams.get("email");
    const oauthId = url.searchParams.get("oauthId");
    const oauthProvider = url.searchParams.get("provider");

    if (error) return Alert.alert(`${provider} 로그인 실패`, error);

    if (oauthId) {
      navigation.navigate("OAuthRegister", { email, oauthId, provider: oauthProvider });
      return;
    }

    if (!token) return Alert.alert(`${provider} 로그인 실패`, "토큰을 받지 못했습니다.");
    setLoading(true);
    try {
      const { data } = await client.get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      await loginWithOAuth({ ...data, token });
      goToMain();
    } catch (e) {
      Alert.alert(`${provider} 로그인 실패`, e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const appReturnUri = AuthSession.makeRedirectUri();
    const callbackUri = `${OAUTH_BASE_URL}/api/auth/google/callback`;
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(callbackUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent("openid profile email")}` +
      `&state=${encodeURIComponent(appReturnUri)}`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, appReturnUri);
    await handleOAuthResult(result, "Google");
  };

  const handleKakaoLogin = async () => {
    const appReturnUri = AuthSession.makeRedirectUri();
    const callbackUri = `${OAUTH_BASE_URL}/api/auth/kakao/callback`;
    const authUrl =
      `https://kauth.kakao.com/oauth/authorize` +
      `?client_id=${KAKAO_REST_API_KEY}` +
      `&redirect_uri=${encodeURIComponent(callbackUri)}` +
      `&response_type=code` +
      `&state=${encodeURIComponent(appReturnUri)}`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, appReturnUri);
    await handleOAuthResult(result, "카카오");
  };

  return (
    <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.inner}>
        <Text style={styles.title}>Team Calendar</Text>
        <Text style={styles.subtitle}>팀과 함께하는 일정 관리</Text>

        <TextInput
          style={styles.input}
          placeholder="이메일"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="비밀번호"
          placeholderTextColor="#aaa"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>로그인</Text>}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity
          style={styles.googleBtn}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          <Text style={styles.googleBtnText}>🔵  Google로 계속하기</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.kakaoBtn} onPress={handleKakaoLogin} disabled={loading}>
          <Text style={styles.kakaoBtnText}>💬  카카오로 계속하기</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Register")} style={styles.registerLink}>
          <Text style={styles.registerText}>계정이 없으신가요? <Text style={styles.registerBold}>회원가입</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fa" },
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  title: { fontSize: 32, fontWeight: "bold", color: "#2c3e50", textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#7f8c8d", textAlign: "center", marginBottom: 36 },
  input: {
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: "#2c3e50", marginBottom: 12,
    borderWidth: 1, borderColor: "#e0e0e0",
  },
  loginBtn: {
    backgroundColor: "#4A90E2", borderRadius: 12, paddingVertical: 15,
    alignItems: "center", marginBottom: 20, marginTop: 4,
  },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  divider: { flex: 1, height: 1, backgroundColor: "#e0e0e0" },
  dividerText: { marginHorizontal: 12, color: "#aaa", fontSize: 13 },
  googleBtn: {
    backgroundColor: "#fff", borderRadius: 12, paddingVertical: 14,
    alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "#e0e0e0",
  },
  googleBtnText: { fontSize: 15, color: "#2c3e50", fontWeight: "500" },
  kakaoBtn: {
    backgroundColor: "#FEE500", borderRadius: 12, paddingVertical: 14,
    alignItems: "center", marginBottom: 28,
  },
  kakaoBtnText: { fontSize: 15, color: "#3C1E1E", fontWeight: "500" },
  registerLink: { alignItems: "center" },
  registerText: { color: "#7f8c8d", fontSize: 14 },
  registerBold: { color: "#4A90E2", fontWeight: "600" },
});
