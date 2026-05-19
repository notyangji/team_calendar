import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword)
      return Alert.alert("알림", "모든 필드를 입력해주세요.");
    if (password !== confirmPassword)
      return Alert.alert("알림", "비밀번호가 일치하지 않습니다.");
    if (password.length < 6)
      return Alert.alert("알림", "비밀번호는 6자 이상이어야 합니다.");

    setLoading(true);
    try {
      await register(name, email, password);
      navigation.replace("Main");
    } catch (e) {
      Alert.alert("회원가입 실패", e.response?.data?.message || "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>

        <Text style={styles.title}>회원가입</Text>
        <Text style={styles.subtitle}>Team Calendar 계정 만들기</Text>

        <TextInput
          style={styles.input}
          placeholder="이름"
          placeholderTextColor="#aaa"
          value={name}
          onChangeText={setName}
        />
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
          placeholder="비밀번호 (6자 이상)"
          placeholderTextColor="#aaa"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="비밀번호 확인"
          placeholderTextColor="#aaa"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.registerBtn} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.registerBtnText}>회원가입</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.loginLink}>
          <Text style={styles.loginText}>이미 계정이 있으신가요? <Text style={styles.loginBold}>로그인</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fa" },
  container: { flex: 1 },
  inner: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 40 },
  backBtn: { marginBottom: 24 },
  backText: { color: "#4A90E2", fontSize: 15 },
  title: { fontSize: 28, fontWeight: "bold", color: "#2c3e50", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#7f8c8d", marginBottom: 32 },
  input: {
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: "#2c3e50", marginBottom: 12,
    borderWidth: 1, borderColor: "#e0e0e0",
  },
  registerBtn: {
    backgroundColor: "#4A90E2", borderRadius: 12, paddingVertical: 15,
    alignItems: "center", marginTop: 4, marginBottom: 20,
  },
  registerBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  loginLink: { alignItems: "center" },
  loginText: { color: "#7f8c8d", fontSize: 14 },
  loginBold: { color: "#4A90E2", fontWeight: "600" },
});
