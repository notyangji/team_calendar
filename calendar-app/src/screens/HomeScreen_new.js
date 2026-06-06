import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  Animated, Modal, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  today, filterDayEvents, SHEET_COLLAPSED, SHEET_EXPANDED, SHEET_MAX,
  CATEGORY_COLORS,
} from "../utils/calendarUtils";
import useBottomSheet from "../hooks/useBottomSheet";
import useDayComponent from "../hooks/useDayComponent";
import useMonthSwipe from "../hooks/useMonthSwipe";
import EventSheet from "../components/EventSheet";
import EventCard from "../components/EventCard";
import { syncEventReminders } from "../utils/notifications";

const CATEGORY_LABELS = {
  work: "업무", meeting: "회의", outdoor: "야외",
  vacation: "휴가", deadline: "마감", personal: "개인",
};

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  // 필터 상태
  const [myTeams, setMyTeams] = useState([]);
  const [filterTeamIds, setFilterTeamIds] = useState(new Set());
  const [filterCategories, setFilterCategories] = useState(new Set());
  const [filterVisible, setFilterVisible] = useState(false);

  const { sheetAnim, snapSheet, panHandlerProps, sheetBodyPanHandlerProps, onListScroll } =
    useBottomSheet(SHEET_COLLAPSED, SHEET_EXPANDED, SHEET_MAX);
  const { displayMonth, setDisplayMonth, goToMonth, slideAnim, swipeHandlers } = useMonthSwipe();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/events");
      const all = Array.isArray(data) ? data : [];
      const myId = String(user?._id || user?.id || "");
      const mine = all.filter(ev => {
        if (ev.team) {
          if (!myId) return false;
          return ev.attendees?.some(a => String(a.userId?._id || a.userId) === myId);
        }
        return true;
      });
      setEvents(mine);
      syncEventReminders(mine);
    } catch (e) {
      console.error("일정 불러오기 실패:", e.message, e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchTeams = useCallback(async () => {
    try {
      const { data } = await client.get("/teams");
      setMyTeams(Array.isArray(data) ? data : []);
    } catch (e) {}
  }, []);

  useFocusEffect(useCallback(() => {
    fetchEvents();
    fetchTeams();
  }, [fetchEvents, fetchTeams]));

  const handleDayPress = useCallback((day) => {
    setSelectedDate(day.dateString);
    snapSheet(true);
  }, [snapSheet]);

  const handleGoToday = useCallback(() => {
    setSelectedDate(today);
    goToMonth(today.substring(0, 7) + "-01");
    snapSheet(true);
  }, [goToMonth, snapSheet]);

  const handleDeleteEvent = useCallback((event) => {
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
  }, [fetchEvents]);

  // 필터 토글
  const toggleTeamFilter = useCallback((id) => {
    setFilterTeamIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleCategoryFilter = useCallback((cat) => {
    setFilterCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilterTeamIds(new Set());
    setFilterCategories(new Set());
  }, []);

  // 필터 적용
  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      if (filterTeamIds.size > 0) {
        const evTeamId = String(ev.sourceTeam?._id || ev.sourceTeam || ev.team?._id || ev.team || "");
        const isPersonal = !ev.sourceTeam && !ev.team;
        if (isPersonal && !filterTeamIds.has("__personal__")) return false;
        if (!isPersonal && !filterTeamIds.has(evTeamId)) return false;
      }
      if (filterCategories.size > 0) {
        if (!filterCategories.has(ev.category || "personal")) return false;
      }
      return true;
    });
  }, [events, filterTeamIds, filterCategories]);

  const dayComponent = useDayComponent(filteredEvents, selectedDate, handleDayPress);
  const dayEvents = filterDayEvents(filteredEvents, selectedDate);
  const filterCount = filterTeamIds.size + filterCategories.size;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Team Calendar</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.todayBtn} onPress={handleGoToday}>
            <Text style={styles.todayBtnText}>오늘</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFilterVisible(true)} style={styles.headerIconBtn}>
            <Ionicons name="filter-outline" size={22} color={filterCount > 0 ? "#4A90E2" : "#7f8c8d"} />
            {filterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{filterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={fetchEvents}>
            <Ionicons name="refresh-outline" size={22} color="#4A90E2" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.calendarWrap} {...swipeHandlers}>
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
          <Calendar
            key={displayMonth}
            current={displayMonth}
            onMonthChange={month => {
              const first = `${month.year}-${String(month.month).padStart(2, "0")}-01`;
              setDisplayMonth(first);
            }}
            dayComponent={dayComponent}
            theme={{
              arrowColor: "#4A90E2",
              textMonthFontSize: 17,
              textMonthFontWeight: "bold",
              monthTextColor: "#2c3e50",
              textSectionTitleColor: "#7f8c8d",
              textDayHeaderFontSize: 12,
              textDayHeaderFontWeight: "600",
              calendarBackground: "#fff",
            }}
            style={styles.calendar}
          />
        </Animated.View>
      </View>

      <EventSheet
        sheetAnim={sheetAnim}
        panHandlerProps={panHandlerProps}
        sheetBodyPanHandlerProps={sheetBodyPanHandlerProps}
        onListScroll={onListScroll}
        selectedDate={selectedDate}
        dayEvents={dayEvents}
        loading={loading}
        renderItem={({ item }) => {
          // ev.team이 있으면 원본 팀 이벤트 → 삭제 불가 (팀 캘린더에서 삭제)
          // ev.sourceTeam && !ev.team 이면 개인 복사본 → 삭제 시 복사본만 제거
          const isTeamOriginal = !!item.team;
          const isTeamRelated = !!item.sourceTeam || isTeamOriginal;
          return (
            <EventCard
              item={item}
              onEdit={!isTeamRelated
                ? () => navigation.navigate("AddEvent", { selectedDate, event: item })
                : undefined}
              onDelete={!isTeamOriginal
                ? () => handleDeleteEvent(item)
                : undefined}
            />
          );
        }}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AddEvent", { selectedDate })}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* 필터 모달 */}
      <Modal visible={filterVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.filterOverlay}
          activeOpacity={1}
          onPress={() => setFilterVisible(false)}
        >
          <View style={styles.filterSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.filterHandle} />
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>필터</Text>
              <TouchableOpacity onPress={resetFilters}>
                <Text style={styles.filterReset}>초기화</Text>
              </TouchableOpacity>
            </View>

            {/* 팀 필터 */}
            <Text style={styles.filterSectionLabel}>팀</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, filterTeamIds.has("__personal__") && styles.chipActive]}
                onPress={() => toggleTeamFilter("__personal__")}
              >
                <Text style={[styles.chipText, filterTeamIds.has("__personal__") && styles.chipTextActive]}>
                  개인 일정
                </Text>
              </TouchableOpacity>
              {myTeams.map(t => {
                const id = String(t._id);
                const active = filterTeamIds.has(id);
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleTeamFilter(id)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 카테고리 필터 */}
            <Text style={styles.filterSectionLabel}>분류</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                const active = filterCategories.has(cat);
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, active && { backgroundColor: CATEGORY_COLORS[cat] + "22", borderColor: CATEGORY_COLORS[cat] }]}
                    onPress={() => toggleCategoryFilter(cat)}
                  >
                    <View style={[styles.catDot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
                    <Text style={[styles.chipText, active && { color: CATEGORY_COLORS[cat], fontWeight: "700" }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.filterConfirmBtn}
              onPress={() => setFilterVisible(false)}
            >
              <Text style={styles.filterConfirmText}>적용</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  todayBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1, borderColor: "#4A90E2",
  },
  todayBtnText: { fontSize: 13, color: "#4A90E2", fontWeight: "600" },
  headerIconBtn: { position: "relative" },
  filterBadge: {
    position: "absolute", top: -4, right: -6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#4A90E2", justifyContent: "center", alignItems: "center",
  },
  filterBadgeText: { fontSize: 9, color: "#fff", fontWeight: "700" },
  calendarWrap: { overflow: "hidden", borderBottomWidth: 1, borderBottomColor: "#eee" },
  calendar: {},
  fab: {
    position: "absolute", bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#4A90E2", justifyContent: "center", alignItems: "center",
    shadowColor: "#4A90E2", shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  // 필터 모달
  filterOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  filterSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingBottom: 32,
  },
  filterHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: "#ddd",
    alignSelf: "center", marginTop: 10, marginBottom: 16,
  },
  filterHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 20,
  },
  filterTitle: { fontSize: 17, fontWeight: "700", color: "#2c3e50" },
  filterReset: { fontSize: 14, color: "#e74c3c" },
  filterSectionLabel: {
    fontSize: 12, fontWeight: "600", color: "#7f8c8d",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
  },
  chipRow: { marginBottom: 20 },
  chip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#f5f6fa", borderWidth: 1, borderColor: "#e0e0e0",
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#e8f0fb", borderColor: "#4A90E2" },
  chipText: { fontSize: 14, color: "#7f8c8d" },
  chipTextActive: { color: "#4A90E2", fontWeight: "600" },
  catDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  filterConfirmBtn: {
    backgroundColor: "#4A90E2", borderRadius: 12, paddingVertical: 14,
    alignItems: "center", marginTop: 4,
  },
  filterConfirmText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
