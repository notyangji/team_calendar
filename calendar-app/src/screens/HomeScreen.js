import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, Modal, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import client from "../api/client";

LocaleConfig.locales["ko"] = {
  monthNames: ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"],
  monthNamesShort: ["1","2","3","4","5","6","7","8","9","10","11","12"],
  dayNames: ["일요일","월요일","화요일","수요일","목요일","금요일","토요일"],
  dayNamesShort: ["일","월","화","수","목","금","토"],
};
LocaleConfig.defaultLocale = "ko";

// 分类配置
const CATEGORIES = [
  { value: "work", label: "작업", color: "#4A90E2" },
  { value: "meeting", label: "회의", color: "#9B59B6" },
  { value: "outdoor", label: "외근", color: "#27AE60" },
  { value: "vacation", label: "휴가", color: "#F39C12" },
  { value: "deadline", label: "마감", color: "#E74C3C" },
  { value: "personal", label: "개인", color: "#1ABC9C" },
];

const getCategoryConfig = (category) => {
  return CATEGORIES.find(c => c.value === category) || CATEGORIES[5];
};

const today = new Date().toISOString().split("T")[0];

export default function HomeScreen({ navigation }) {
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState([]);
  const [markedDates, setMarkedDates] = useState({});
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (categoryFilter) params.category = categoryFilter;
      
      const { data } = await client.get("/events", { params });
      const list = Array.isArray(data) ? data : [];
      setEvents(list);

      // 更新日历标记
      const marks = {};
      list.forEach((event) => {
        const date = event.startDate.split("T")[0];
        const catConfig = getCategoryConfig(event.category);
        if (!marks[date]) {
          marks[date] = { dots: [] };
        }
        marks[date].dots.push({ key: event.category, color: catConfig.color });
      });
      
      // 保留选中日期的样式
      if (marks[selectedDate]) {
        marks[selectedDate] = {
          ...marks[selectedDate],
          selected: true,
          selectedColor: "#4A90E2",
        };
      } else {
        marks[selectedDate] = {
          selected: true,
          selectedColor: "#4A90E2",
          dots: [],
        };
      }
      setMarkedDates(marks);
    } catch (e) {
      console.error("일정 불러오기 실패:", e.message, e);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, categoryFilter]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
    setMarkedDates((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((k) => {
        if (k !== day.dateString) {
          updated[k] = { ...updated[k], selected: false };
        }
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

  const handleEventPress = (event) => {
    const catConfig = getCategoryConfig(event.category);
    const attendeeCount = event.attendees?.length || 0;
    
    Alert.alert(
      event.title,
      [
        { text: "수정", onPress: () => navigation.navigate("AddEvent", { selectedDate, event }) },
        {
          text: "삭제", style: "destructive", onPress: () =>
            Alert.alert("삭제 확인", "이 일정을 삭제할까요?", [
              { text: "취소", style: "cancel" },
              {
                text: "삭제", style: "destructive", onPress: async () => {
                  try {
                    await client.delete(`/events/${event._id}`);
                    fetchEvents();
                  } catch {
                    Alert.alert("오류", "일정을 삭제하지 못했습니다.");
                  }
                },
              },
            ]),
        },
        { text: "취소", style: "cancel" },
      ]
    );
  };

  const renderEventCard = ({ item }) => {
    const catConfig = getCategoryConfig(item.category);
    const attendeeCount = item.attendees?.filter(a => a.status !== "declined").length || 0;
    
    return (
      <TouchableOpacity style={styles.eventCard} onPress={() => handleEventPress(item)}>
        <View style={[styles.categoryBar, { backgroundColor: catConfig.color }]} />
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
            <View style={[styles.categoryBadge, { backgroundColor: `${catConfig.color}20` }]}>
              <Text style={[styles.categoryText, { color: catConfig.color }]}>
                {catConfig.label}
              </Text>
            </View>
          </View>
          
          {item.description ? (
            <Text style={styles.eventDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
          
          <View style={styles.eventMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={12} color="#aaa" />
              <Text style={styles.metaText}>
                {item.allDay 
                  ? "하루 종일" 
                  : new Date(item.startDate).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
            
            {item.location ? (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={12} color="#aaa" />
                <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
              </View>
            ) : null}
            
            {attendeeCount > 0 && (
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={12} color="#aaa" />
                <Text style={styles.metaText}>{attendeeCount}명</Text>
              </View>
            )}
          </View>
          
          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagRow}>
              {item.tags.slice(0, 3).map((tag, idx) => (
                <View key={idx} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color="#ccc" />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Team Calendar</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.filterBtn} 
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons 
              name={categoryFilter ? "filter" : "filter-outline"} 
              size={22} 
              color={categoryFilter ? "#4A90E2" : "#7f8c8d"} 
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={fetchEvents}>
            <Ionicons name="refresh-outline" size={22} color="#4A90E2" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 分类筛选指示器 */}
      {categoryFilter && (
        <TouchableOpacity 
          style={styles.filterIndicator}
          onPress={() => setCategoryFilter(null)}
        >
          <View style={[styles.filterDot, { backgroundColor: getCategoryConfig(categoryFilter).color }]} />
          <Text style={styles.filterText}>
            {getCategoryConfig(categoryFilter).label}筛选中
          </Text>
          <Ionicons name="close-circle" size={16} color="#7f8c8d" />
        </TouchableOpacity>
      )}

      <Calendar
        current={today}
        onDayPress={handleDayPress}
        markedDates={markedDates}
        markingType="multi-dot"
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
          <Text style={styles.eventCount}> ({dayEvents.length})</Text>
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
            renderItem={renderEventCard}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 80 }}
          />
        )}
      </View>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AddEvent", { selectedDate })}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* 分类筛选弹窗 */}
      <Modal visible={showFilterModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>분류 필터</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color="#2c3e50" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.filterOption, !categoryFilter && styles.filterOptionActive]}
              onPress={() => { setCategoryFilter(null); setShowFilterModal(false); }}
            >
              <Text style={[styles.filterOptionText, !categoryFilter && styles.filterOptionTextActive]}>
                전체 보기
              </Text>
            </TouchableOpacity>
            
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[styles.filterOption, categoryFilter === cat.value && styles.filterOptionActive]}
                onPress={() => { setCategoryFilter(cat.value); setShowFilterModal(false); }}
              >
                <View style={[styles.filterDot, { backgroundColor: cat.color }]} />
                <Text style={[styles.filterOptionText, categoryFilter === cat.value && styles.filterOptionTextActive]}>
                  {cat.label}
                </Text>
                {categoryFilter === cat.value && (
                  <Ionicons name="checkmark" size={20} color="#4A90E2" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
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
  headerActions: { flexDirection: "row", gap: 16 },
  filterBtn: { padding: 2 },
  filterIndicator: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    paddingHorizontal: 16, paddingVertical: 8, gap: 6,
    borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterText: { fontSize: 13, color: "#7f8c8d", flex: 1 },
  eventSection: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  dateLabel: { fontSize: 15, fontWeight: "600", color: "#2c3e50", marginBottom: 12 },
  eventCount: { fontSize: 13, color: "#7f8c8d", fontWeight: "normal" },
  emptyBox: { alignItems: "center", marginTop: 40 },
  emptyText: { color: "#aaa", marginTop: 8, fontSize: 14 },
  eventCard: {
    flexDirection: "row", alignItems: "stretch", backgroundColor: "#fff",
    borderRadius: 12, marginBottom: 10, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  categoryBar: { width: 4 },
  eventContent: { flex: 1, padding: 12 },
  eventHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  eventTitle: { fontSize: 15, fontWeight: "600", color: "#2c3e50", flex: 1 },
  categoryBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  categoryText: { fontSize: 11, fontWeight: "500" },
  eventDesc: { fontSize: 13, color: "#7f8c8d", marginTop: 4 },
  eventMeta: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: "#aaa" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  tag: {
    backgroundColor: "#f0f0f0", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  tagText: { fontSize: 11, color: "#7f8c8d" },
  fab: {
    position: "absolute", bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#4A90E2", justifyContent: "center", alignItems: "center",
    shadowColor: "#4A90E2", shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  // Modal styles
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  modalTitle: { fontSize: 17, fontWeight: "600", color: "#2c3e50" },
  filterOption: {
    flexDirection: "row", alignItems: "center", padding: 16, gap: 12,
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  filterOptionActive: { backgroundColor: "#f0f7ff" },
  filterOptionText: { fontSize: 15, color: "#2c3e50", flex: 1 },
  filterOptionTextActive: { color: "#4A90E2", fontWeight: "600" },
});
