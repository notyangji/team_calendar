import React from "react";
import { View, Text, StyleSheet, Animated, FlatList, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const DAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];
const getDayOfWeek = (dateStr) => DAYS_KR[new Date(dateStr + "T12:00:00Z").getUTCDay()];

export default function EventSheet({
  sheetAnim, panHandlerProps, sheetBodyPanHandlerProps, onListScroll,
  selectedDate, dayEvents, loading, renderItem,
}) {
  return (
    <Animated.View style={[s.sheet, { height: sheetAnim }]}>
      {/* 핸들: 위아래 드래그 */}
      <View style={s.handle} {...panHandlerProps}>
        <View style={s.bar} />
        <View style={s.dateRow}>
          <Text style={s.dateText}>
            {selectedDate.replace(/-/g, ".")}  {getDayOfWeek(selectedDate)}요일
          </Text>
          <Text style={s.countText}>{dayEvents.length}개 일정</Text>
        </View>
      </View>

      {/* 바디: 아래로 드래그하면 시트 닫힘, 위로 스크롤은 FlatList가 정상 처리 */}
      <View style={s.body} {...sheetBodyPanHandlerProps}>
        {loading ? (
          <ActivityIndicator color="#4A90E2" style={{ marginTop: 20 }} />
        ) : dayEvents.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="calendar-outline" size={36} color="#ccc" />
            <Text style={s.emptyText}>일정이 없습니다</Text>
          </View>
        ) : (
          <FlatList
            data={dayEvents}
            keyExtractor={item => item._id}
            contentContainerStyle={s.listContent}
            nestedScrollEnabled
            scrollEventThrottle={16}
            onScroll={onListScroll}
            renderItem={renderItem}
          />
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, elevation: 10,
  },
  handle: { paddingTop: 10, paddingHorizontal: 20, paddingBottom: 12 },
  bar: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ddd", alignSelf: "center", marginBottom: 12 },
  dateRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateText: { fontSize: 15, fontWeight: "700", color: "#2c3e50" },
  countText: { fontSize: 13, color: "#7f8c8d" },
  body: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  empty: { alignItems: "center", paddingTop: 20 },
  emptyText: { color: "#aaa", marginTop: 8, fontSize: 14 },
});
