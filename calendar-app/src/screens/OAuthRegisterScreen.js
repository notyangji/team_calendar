import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function OAuthRegisterScreen({ navigation, route }) {
  const { email, oauthId, provider } = route.params;
  const { loginWithOAuth } = useAuth();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const providerLabel = provider === "google" ? "Google" : "카카오";

  const handleComplete = async () => {
    if (!name.trim()) return Alert.alert("알림", "이름을 입력해주세요.");
    setLoading(true);
    try {
      const { data } = await client.post("/auth/oauth-register", { name: name.trim(), email, oauthId, provider });
      await loginWithOAuth(data);
      navigation.replace("Main");
    } catch (e) {
      Alert.alert("오류", e.response?.data?.message || "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.inner}>
          <Text style={styles.title}>프로필 설정</Text>
          <Text style={styles.subtitle}>
            {providerLabel} 계정으로 처음 로그인했어요.{"\n"}사용할 이름을 입력해주세요.
          </Text>

          {email ? (
            <View style={styles.emailBox}>
              <Text style={styles.emailLabel}>이메일</Text>
              <Text style={styles.emailValue}>{email}</Text>
            </View>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder="이름"
            placeholderTextColor="#aaa"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <TouchableOpacity style={styles.btn} onPress={handleComplete} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>시작하기</Text>
            }
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
  title: { fontSize: 28, fontWeight: "bold", color: "#2c3e50", marginBottom: 10 },
  subtitle: { fontSize: 15, color: "#7f8c8d", lineHeight: 22, marginBottom: 32 },
  emailBox: {
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 12, borderWidth: 1, borderColor: "#e0e0e0",
  },
  emailLabel: { fontSize: 11, color: "#aaa", marginBottom: 2 },
  emailValue: { fontSize: 15, color: "#2c3e50" },
  input: {
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: "#2c3e50", marginBottom: 20,
    borderWidth: 1, borderColor: "#e0e0e0",
  },
  btn: {
    backgroundColor: "#4A90E2", borderRadius: 12, paddingVertical: 15, alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
