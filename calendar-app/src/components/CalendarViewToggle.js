import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function CalendarViewToggle({ viewMode, setViewMode, weekLabel, onPrevWeek, onNextWeek }) {
  return (
    <View style={s.modeRow}>
      <View style={s.segment}>
        <TouchableOpacity
          style={[s.segBtn, viewMode === "month" && s.segBtnActive]}
          onPress={() => setViewMode("month")}
        >
          <Text style={[s.segText, viewMode === "month" && s.segTextActive]}>월</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.segBtn, viewMode === "week" && s.segBtnActive]}
          onPress={() => setViewMode("week")}
        >
          <Text style={[s.segText, viewMode === "week" && s.segTextActive]}>주</Text>
        </TouchableOpacity>
      </View>
      {viewMode === "week" && (
        <View style={s.weekNav}>
          <TouchableOpacity onPress={onPrevWeek} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color="#4A90E2" />
          </TouchableOpacity>
          <Text style={s.weekNavLabel}>{weekLabel}</Text>
          <TouchableOpacity onPress={onNextWeek} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color="#4A90E2" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  modeRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#fff",
  },
  segment: { flexDirection: "row", backgroundColor: "#f0f0f0", borderRadius: 8, padding: 2 },
  segBtn: { paddingHorizontal: 16, paddingVertical: 5, borderRadius: 6 },
  segBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  segText: { fontSize: 13, color: "#7f8c8d", fontWeight: "600" },
  segTextActive: { color: "#2c3e50" },
  weekNav: { flexDirection: "row", alignItems: "center", gap: 10 },
  weekNavLabel: { fontSize: 15, fontWeight: "700", color: "#2c3e50", minWidth: 92, textAlign: "center" },
});
