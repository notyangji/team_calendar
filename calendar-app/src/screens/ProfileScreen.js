import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
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
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#e74c3c" />
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>
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
  profileBox: { alignItems: "center", paddingVertical: 40 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#4A90E2",
    justifyContent: "center", alignItems: "center", marginBottom: 14,
  },
  name: { fontSize: 20, fontWeight: "bold", color: "#2c3e50" },
  email: { fontSize: 14, color: "#7f8c8d", marginTop: 4 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginHorizontal: 28, padding: 14, borderRadius: 12,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e74c3c",
  },
  logoutText: { color: "#e74c3c", fontSize: 15, fontWeight: "600", marginLeft: 8 },
});
