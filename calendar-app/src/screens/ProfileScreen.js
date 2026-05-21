import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import { useAuth } from "../context/AuthContext";
import changelog from "../changelog.json";

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [changelogVisible, setChangelogVisible] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    } catch (error) {
      Alert.alert("오류", "로그아웃 중 오류가 발생했습니다.");
    }
  };

  const handleCheckUpdate = async () => {
    if (__DEV__) {
      Alert.alert("업데이트", "개발 모드에서는 업데이트를 확인할 수 없습니다.");
      return;
    }
    setUpdateLoading(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        Alert.alert("업데이트", "최신 버전을 사용 중입니다.");
        return;
      }
      await Updates.fetchUpdateAsync();
      Alert.alert(
        "업데이트 완료",
        "새 버전이 다운로드되었습니다. 지금 재시작할까요?",
        [
          { text: "나중에" },
          { text: "재시작", onPress: async () => { try { await Updates.reloadAsync(); } catch {} } },
        ]
      );
    } catch {
      Alert.alert("업데이트 확인 실패", "네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.");
    } finally {
      setUpdateLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>프로필</Text>
      </View>

      <View style={styles.profileBox}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color="#fff" />
        </View>
        <Text style={styles.name}>{user?.name || "사용자"}</Text>
        <Text style={styles.email}>{user?.email || ""}</Text>
        <Text style={styles.currentVersion}>현재 버전 v{changelog[0]?.version}</Text>
      </View>

      <TouchableOpacity style={styles.menuBtn} onPress={() => setChangelogVisible(true)}>
        <Ionicons name="list-outline" size={20} color="#4A90E2" />
        <Text style={styles.menuBtnText}>업데이트 내역</Text>
        <Ionicons name="chevron-forward" size={16} color="#bbb" style={{ marginLeft: "auto" }} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuBtn} onPress={handleCheckUpdate} disabled={updateLoading}>
        <Ionicons name="cloud-download-outline" size={20} color="#4A90E2" />
        <Text style={styles.menuBtnText}>업데이트 확인</Text>
        {updateLoading
          ? <ActivityIndicator size="small" color="#4A90E2" style={{ marginLeft: "auto" }} />
          : <Ionicons name="chevron-forward" size={16} color="#bbb" style={{ marginLeft: "auto" }} />
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#e74c3c" />
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>

      <Modal visible={changelogVisible} transparent animationType="slide">
        <TouchableOpacity style={clStyles.overlay} activeOpacity={1} onPress={() => setChangelogVisible(false)}>
          <View style={clStyles.sheet} onStartShouldSetResponder={() => true}>
            <View style={clStyles.sheetHeader}>
              <Text style={clStyles.sheetTitle}>업데이트 내역</Text>
              <TouchableOpacity onPress={() => setChangelogVisible(false)}>
                <Ionicons name="close" size={22} color="#7f8c8d" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {changelog.map((entry) => (
                <View key={entry.version} style={clStyles.entry}>
                  <View style={clStyles.entryHeader}>
                    <Text style={clStyles.entryVersion}>v{entry.version}</Text>
                    <Text style={clStyles.entryDate}>{entry.date}</Text>
                  </View>
                  {entry.notes.map((note, i) => (
                    <Text key={i} style={clStyles.entryNote}>• {note}</Text>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa" },
  header: {
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#2c3e50" },
  profileBox: { alignItems: "center", paddingVertical: 36 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#4A90E2",
    justifyContent: "center", alignItems: "center", marginBottom: 14,
  },
  name: { fontSize: 20, fontWeight: "bold", color: "#2c3e50" },
  email: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },
  currentVersion: { fontSize: 12, color: "#bbb", marginTop: 6 },
  menuBtn: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 28, marginBottom: 12, padding: 14, borderRadius: 12,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee",
  },
  menuBtnText: { color: "#2c3e50", fontSize: 15, marginLeft: 10 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginHorizontal: 28, padding: 14, borderRadius: 12,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e74c3c",
  },
  logoutText: { color: "#e74c3c", fontSize: 15, fontWeight: "600", marginLeft: 8 },
});

const clStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, maxHeight: "75%",
  },
  sheetHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 17, fontWeight: "bold", color: "#2c3e50" },
  entry: {
    marginBottom: 24, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  entryHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 10 },
  entryVersion: { fontSize: 15, fontWeight: "bold", color: "#4A90E2" },
  entryDate: { fontSize: 12, color: "#aaa" },
  entryNote: { fontSize: 14, color: "#34495e", lineHeight: 22, marginBottom: 2 },
});
