import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Switch,
  KeyboardAvoidingView, Platform, ScrollView, SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import client from "../api/client";

export default function AddEventScreen({ navigation, route }) {
  const initialDate = route.params?.selectedDate ?? new Date().toISOString().split("T")[0];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(initialDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState(initialDate);
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert("알림", "제목을 입력해주세요.");

    const startISO = allDay ? `${startDate}T00:00:00.000Z` : `${startDate}T${startTime}:00.000Z`;
    const endISO = allDay ? `${endDate}T23:59:59.000Z` : `${endDate}T${endTime}:00.000Z`;

    if (new Date(startISO) > new Date(endISO)) {
      return Alert.alert("알림", "종료 시간이 시작 시간보다 빠를 수 없습니다.");
    }

    setLoading(true);
    try {
      await client.post("/events", {
        title: title.trim(),
        description: description.trim(),
        startDate: startISO,
        endDate: endISO,
        allDay,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert("오류", e.response?.data?.message || "일정을 저장하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>새 일정</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#4A90E2" />
            ) : (
              <Text style={styles.saveText}>저장</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.titleInput}
            placeholder="제목"
            placeholderTextColor="#aaa"
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            style={styles.descInput}
            placeholder="메모 (선택)"
            placeholderTextColor="#aaa"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>하루 종일</Text>
            <Switch
              value={allDay}
              onValueChange={setAllDay}
              trackColor={{ true: "#4A90E2" }}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>시작</Text>
            <View style={styles.dateRow}>
              <TextInput
                style={styles.dateInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#aaa"
              />
              {!allDay && (
                <TextInput
                  style={[styles.dateInput, styles.timeInput]}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="HH:MM"
                  placeholderTextColor="#aaa"
                />
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>종료</Text>
            <View style={styles.dateRow}>
              <TextInput
                style={styles.dateInput}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#aaa"
              />
              {!allDay && (
                <TextInput
                  style={[styles.dateInput, styles.timeInput]}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="HH:MM"
                  placeholderTextColor="#aaa"
                />
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fa" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  headerBtn: { width: 60, alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "600", color: "#2c3e50" },
  saveText: { color: "#4A90E2", fontSize: 16, fontWeight: "600" },
  body: { flex: 1, padding: 20 },
  titleInput: {
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 17, color: "#2c3e50", marginBottom: 12,
    borderWidth: 1, borderColor: "#e0e0e0",
  },
  descInput: {
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: "#2c3e50", marginBottom: 20, minHeight: 80,
    borderWidth: 1, borderColor: "#e0e0e0", textAlignVertical: "top",
  },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 12, borderWidth: 1, borderColor: "#e0e0e0",
  },
  rowLabel: { fontSize: 15, color: "#2c3e50" },
  section: { marginBottom: 12 },
  sectionLabel: { fontSize: 13, color: "#7f8c8d", marginBottom: 6, marginLeft: 4 },
  dateRow: { flexDirection: "row", gap: 8 },
  dateInput: {
    flex: 2, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: "#2c3e50", borderWidth: 1, borderColor: "#e0e0e0",
  },
  timeInput: { flex: 1 },
});
