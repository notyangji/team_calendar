import React, { useState, useMemo, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Switch,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import client from "../api/client";

const formatDate = (raw) => {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
};

const formatTime = (raw) => {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
};

const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s));

const nextDay = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
};

function parseDate(iso) { return iso?.split("T")[0] ?? ""; }
function parseTime(iso) { return iso?.split("T")[1]?.slice(0, 5) ?? ""; }

export default function AddEventScreen({ navigation, route }) {
  const existingEvent = route.params?.event ?? null;
  const initialDate = route.params?.selectedDate ?? new Date().toISOString().split("T")[0];
  const isEdit = existingEvent !== null;

  const [title, setTitle] = useState(existingEvent?.title ?? "");
  const [description, setDescription] = useState(existingEvent?.description ?? "");
  const [startDate, setStartDate] = useState(isEdit ? parseDate(existingEvent.startDate) : initialDate);
  const [startTime, setStartTime] = useState(isEdit ? parseTime(existingEvent.startDate) : "09:00");
  const [endDate, setEndDate] = useState(isEdit ? parseDate(existingEvent.endDate) : initialDate);
  const [endTime, setEndTime] = useState(isEdit ? parseTime(existingEvent.endDate) : "10:00");
  const [allDay, setAllDay] = useState(existingEvent?.allDay ?? false);
  const [loading, setLoading] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState("start");

  // 달력 초기 표시 월: 마운트 시점 startDate로 고정 (타이핑 중 월 이동 방지)
  const calendarInitialDate = useRef(
    isValidDate(startDate) ? startDate : new Date().toISOString().split("T")[0]
  ).current;

  const calendarMarked = useMemo(() => {
    const marks = {};
    if (!isValidDate(startDate)) return marks;
    if (!isValidDate(endDate) || startDate === endDate || startDate > endDate) {
      marks[startDate] = { startingDay: true, endingDay: true, color: "#4A90E2", textColor: "#fff" };
      return marks;
    }
    marks[startDate] = { startingDay: true, color: "#4A90E2", textColor: "#fff" };
    marks[endDate] = { endingDay: true, color: "#4A90E2", textColor: "#fff" };
    let cur = nextDay(startDate);
    while (cur < endDate) {
      marks[cur] = { color: "#B3D1F5", textColor: "#2c3e50" };
      cur = nextDay(cur);
    }
    return marks;
  }, [startDate, endDate]);

  const handleCalendarDayPress = (day) => {
    if (calendarTarget === "start") {
      setStartDate(day.dateString);
      if (endDate && day.dateString > endDate) setEndDate(day.dateString);
      setCalendarTarget("end");
    } else {
      if (day.dateString < startDate) {
        setStartDate(day.dateString);
        setCalendarTarget("end");
      } else {
        setEndDate(day.dateString);
      }
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert("알림", "제목을 입력해주세요.");
    if (!isValidDate(startDate) || !isValidDate(endDate))
      return Alert.alert("알림", "날짜 형식이 올바르지 않습니다.\n예: 2026-05-21");

    const startISO = allDay ? `${startDate}T00:00:00.000Z` : `${startDate}T${startTime}:00.000Z`;
    const endISO = allDay ? `${endDate}T23:59:59.000Z` : `${endDate}T${endTime}:00.000Z`;

    if (new Date(startISO) > new Date(endISO))
      return Alert.alert("알림", "종료 시간이 시작 시간보다 빠를 수 없습니다.");

    setLoading(true);
    try {
      if (isEdit) {
        await client.put(`/events/${existingEvent._id}`, {
          title: title.trim(), description: description.trim(),
          startDate: startISO, endDate: endISO, allDay,
        });
      } else {
        await client.post("/events", {
          title: title.trim(), description: description.trim(),
          startDate: startISO, endDate: endISO, allDay,
        });
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert("오류", e?.response?.data?.message || e?.message || "일정을 저장하지 못했습니다.");
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
          <Text style={styles.headerTitle}>{isEdit ? "일정 수정" : "새 일정"}</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color="#4A90E2" />
              : <Text style={styles.saveText}>저장</Text>}
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
            <Switch value={allDay} onValueChange={setAllDay} trackColor={{ true: "#4A90E2" }} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>시작</Text>
            <View style={styles.dateRow}>
              <TextInput
                style={[styles.dateInput, calendarTarget === "start" && styles.dateInputActive]}
                value={startDate}
                onChangeText={(t) => setStartDate(formatDate(t))}
                onFocus={() => setCalendarTarget("start")}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
                maxLength={10}
              />
              {!allDay && (
                <TextInput
                  style={[styles.dateInput, styles.timeInput]}
                  value={startTime}
                  onChangeText={(t) => setStartTime(formatTime(t))}
                  placeholder="HH:MM"
                  placeholderTextColor="#aaa"
                  keyboardType="number-pad"
                  maxLength={5}
                />
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>종료</Text>
            <View style={styles.dateRow}>
              <TextInput
                style={[styles.dateInput, calendarTarget === "end" && styles.dateInputActive]}
                value={endDate}
                onChangeText={(t) => setEndDate(formatDate(t))}
                onFocus={() => setCalendarTarget("end")}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
                maxLength={10}
              />
              {!allDay && (
                <TextInput
                  style={[styles.dateInput, styles.timeInput]}
                  value={endTime}
                  onChangeText={(t) => setEndTime(formatTime(t))}
                  placeholder="HH:MM"
                  placeholderTextColor="#aaa"
                  keyboardType="number-pad"
                  maxLength={5}
                />
              )}
            </View>
          </View>

          <View style={styles.calendarCard}>
            <View style={styles.calendarTabs}>
              <TouchableOpacity
                style={[styles.calendarTab, calendarTarget === "start" && styles.calendarTabActive]}
                onPress={() => setCalendarTarget("start")}
              >
                <Text style={[styles.calendarTabText, calendarTarget === "start" && styles.calendarTabTextActive]}>
                  시작일
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.calendarTab, calendarTarget === "end" && styles.calendarTabActive]}
                onPress={() => setCalendarTarget("end")}
              >
                <Text style={[styles.calendarTabText, calendarTarget === "end" && styles.calendarTabTextActive]}>
                  종료일
                </Text>
              </TouchableOpacity>
            </View>
            <Calendar
              current={calendarInitialDate}
              onDayPress={handleCalendarDayPress}
              markedDates={calendarMarked}
              markingType="period"
              theme={{
                todayTextColor: "#4A90E2",
                arrowColor: "#4A90E2",
                textDayFontSize: 14,
                textMonthFontSize: 15,
                textMonthFontWeight: "bold",
              }}
            />
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
  dateInputActive: { borderColor: "#4A90E2" },
  timeInput: { flex: 1 },
  calendarCard: {
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e0e0e0",
    overflow: "hidden", marginBottom: 20,
  },
  calendarTabs: {
    flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  calendarTab: {
    flex: 1, paddingVertical: 11, alignItems: "center",
  },
  calendarTabActive: {
    borderBottomWidth: 2, borderBottomColor: "#4A90E2",
  },
  calendarTabText: { fontSize: 14, color: "#aaa" },
  calendarTabTextActive: { color: "#4A90E2", fontWeight: "600" },
});
