import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import changelog from "../changelog.json";
import WeeklyFreeTimeModal from "../components/WeeklyFreeTimeModal";

export default function ProfileScreen({ navigation }) {
  const { user, logout, updateUser } = useAuth();
  const [changelogVisible, setChangelogVisible] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [nameModal, setNameModal] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [freeTimeVisible, setFreeTimeVisible] = useState(false);

  const openNameModal = () => {
    setNameInput(user?.name || "");
    setNameModal(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return Alert.alert("알림", "이름을 입력해주세요.");
    setSavingName(true);
    try {
      const { data } = await client.put("/auth/me", { name: trimmed });
      await updateUser({ name: data.name });
      setNameModal(false);
    } catch (e) {
      Alert.alert("오류", e?.response?.data?.message || "이름 변경에 실패했습니다.");
    } finally {
      setSavingName(false);
    }
  };

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
        <TouchableOpacity style={styles.nameRow} onPress={openNameModal} activeOpacity={0.7}>
          <Text style={styles.name}>{user?.name || "사용자"}</Text>
          <Ionicons name="pencil" size={16} color="#7f8c8d" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
        <Text style={styles.email}>{user?.email || ""}</Text>
        <Text style={styles.currentVersion}>현재 버전 v{changelog[0]?.version}</Text>
      </View>

      <TouchableOpacity style={styles.menuBtn} onPress={() => setFreeTimeVisible(true)}>
        <Ionicons name="time-outline" size={20} color="#4A90E2" />
        <Text style={styles.menuBtnText}>주간 여유 시간 설정</Text>
        <Ionicons name="chevron-forward" size={16} color="#bbb" style={{ marginLeft: "auto" }} />
      </TouchableOpacity>

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

      <Modal visible={nameModal} transparent animationType="fade">
        <TouchableOpacity style={nmStyles.overlay} activeOpacity={1} onPress={() => setNameModal(false)}>
          <View style={nmStyles.box} onStartShouldSetResponder={() => true}>
            <Text style={nmStyles.title}>이름 수정</Text>
            <TextInput
              style={nmStyles.input}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="이름을 입력하세요"
              maxLength={20}
              autoFocus
            />
            <View style={nmStyles.btnRow}>
              <TouchableOpacity style={[nmStyles.btn, nmStyles.cancelBtn]} onPress={() => setNameModal(false)}>
                <Text style={nmStyles.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[nmStyles.btn, nmStyles.saveBtn]} onPress={handleSaveName} disabled={savingName}>
                {savingName ? <ActivityIndicator color="#fff" /> : <Text style={nmStyles.saveText}>저장</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <WeeklyFreeTimeModal
        visible={freeTimeVisible}
        onClose={() => setFreeTimeVisible(false)}
        initial={user?.weeklyFreeTime}
        onSaved={(weeklyFreeTime) => updateUser({ weeklyFreeTime })}
      />
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
  nameRow: { flexDirection: "row", alignItems: "center" },
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

const nmStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 24 },
  box: { backgroundColor: "#fff", borderRadius: 16, padding: 20, width: "100%" },
  title: { fontSize: 17, fontWeight: "bold", color: "#2c3e50", marginBottom: 16 },
  input: {
    borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: "#2c3e50",
  },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  cancelBtn: { backgroundColor: "#f5f6fa", borderWidth: 1, borderColor: "#e0e0e0" },
  cancelText: { color: "#7f8c8d", fontSize: 15, fontWeight: "600" },
  saveBtn: { backgroundColor: "#4A90E2" },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "600" },
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
