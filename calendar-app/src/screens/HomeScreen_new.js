import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import client from "../api/client";

LocaleConfig.locales["ko"] = {
  monthNames: ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"],
  monthNamesShort: ["1","2","3","4","5","6","7","8","9","10","11","12"],
  dayNames: ["일요일","월요일","화요일","수요일","목요일","금요일","토요일"],
  dayNamesShort: ["일","월","화","수","목","금","토"],
};
LocaleConfig.defaultLocale = "ko";

const today = new Date().toISOString().split("T")[0];

const formatTimeKr = (isoDate) => {
  const t = isoDate?.split("T")[1]?.slice(0, 5);
  if (!t) return "시간 미설정";
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${ampm} ${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export default function HomeScreen({ navigation }) {
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState([]);
  const [markedDates, setMarkedDates] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/events");
      const list = Array.isArray(data) ? data : [];
      setEvents(list);

      const marks = {};
      list.forEach((event) => {
        try {
          const date = event?.startDate?.split?.("T")?.[0];
          if (date) {
            marks[date] = {
              marked: true,
              dotColor: "#4A90E2",
            };
          }
        } catch (err) {
          console.error("이벤트 날짜 파싱 오류:", event, err);
        }
      });
      marks[selectedDate] = {
        ...(marks[selectedDate] || {}),
        selected: true,
        selectedColor: "#4A90E2",
      };
      setMarkedDates(marks);
    } catch (e) {
      console.error("일정 불러오기 실패:", e.message, e);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents])
  );

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
    setMarkedDates((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((k) => {
        updated[k] = { ...updated[k], selected: false };
      });
      updated[day.dateString] = {
        ...(updated[day.dateString] || {}),
        selected: true,
        selectedColor: "#4A90E2",
      };
      return updated;
    });
  };

  const dayEvents = events.filter((e) => {
    try {
      return e?.startDate?.split?.("T")?.[0] === selectedDate;
    } catch {
      return false;
    }
  });

  const handleDeleteEvent = (event) => {
    Alert.alert("일정 삭제", `"${event.title}" 일정을 삭제하시겠습니까?`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive", onPress: async () => {
          try {
            await client.delete(`/events/${event._id}`);
            fetchEvents();
          } catch (e) {
            Alert.alert("오류", e?.response?.data?.message || "일정을 삭제하지 못했습니다.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Team Calendar</Text>
        <TouchableOpacity onPress={fetchEvents}>
          <Ionicons name="refresh-outline" size={22} color="#4A90E2" />
        </TouchableOpacity>
      </View>

      <Calendar
        current={today}
        onDayPress={handleDayPress}
        markedDates={markedDates}
        theme={{
          todayTextColor: "#4A90E2",
          arrowColor: "#4A90E2",
          selectedDayBackgroundColor: "#4A90E2",
          dotColor: "#4A90E2",
          textDayFontSize: 14,
          textMonthFontSize: 16,
          textMonthFontWeight: "bold",
        }}
      />

      <View style={styles.eventSection}>
        <Text style={styles.dateLabel}>
          {selectedDate.replace(/-/g, ".")} 일정
        </Text>

        {loading ? (
          <ActivityIndicator color="#4A90E2" style={{ marginTop: 20 }} />
        ) : dayEvents.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={40} color="#ccc" />
            <Text style={styles.emptyText}>일정이 없습니다</Text>
          </View>
        ) : (
          <FlatList
            data={dayEvents}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <View style={styles.eventCard}>
                <View style={styles.eventDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>{item.title}</Text>
                  {item.description ? (
                    <Text style={styles.eventDesc}>{item.description}</Text>
                  ) : null}
                  <Text style={styles.eventTime}>
                    {item.allDay ? "하루 종일" : formatTimeKr(item.startDate)}
                  </Text>
                </View>
                <View style={styles.eventActions}>
                  <TouchableOpacity
                    style={styles.eventActionBtn}
                    onPress={() => navigation.navigate("AddEvent", { selectedDate, event: item })}
                  >
                    <Ionicons name="pencil-outline" size={15} color="#4A90E2" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.eventActionBtn}
                    onPress={() => handleDeleteEvent(item)}
                  >
                    <Ionicons name="trash-outline" size={15} color="#e74c3c" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AddEvent", { selectedDate })}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#2c3e50" },
  eventSection: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  dateLabel: { fontSize: 15, fontWeight: "600", color: "#2c3e50", marginBottom: 12 },
  emptyBox: { alignItems: "center", marginTop: 40 },
  emptyText: { color: "#aaa", marginTop: 8, fontSize: 14 },
  eventCard: {
    flexDirection: "row", alignItems: "flex-start", backgroundColor: "#fff",
    borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  eventDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: "#4A90E2",
    marginTop: 4, marginRight: 10,
  },
  eventTitle: { fontSize: 15, fontWeight: "600", color: "#2c3e50" },
  eventDesc: { fontSize: 13, color: "#7f8c8d", marginTop: 2 },
  eventTime: { fontSize: 12, color: "#aaa", marginTop: 4 },
  eventActions: { flexDirection: "row", gap: 4, marginLeft: 8 },
  eventActionBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: "#f5f6fa",
    justifyContent: "center", alignItems: "center",
  },
  fab: {
    position: "absolute", bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#4A90E2", justifyContent: "center", alignItems: "center",
    shadowColor: "#4A90E2", shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
});
