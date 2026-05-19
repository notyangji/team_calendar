import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function TeamsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>팀 관리</Text>
      </View>
      <View style={styles.body}>
        <Ionicons name="people-outline" size={60} color="#ccc" />
        <Text style={styles.text}>팀 기능 구현 예정</Text>
      </View>
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
  body: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { color: "#aaa", marginTop: 12, fontSize: 15 },
});
