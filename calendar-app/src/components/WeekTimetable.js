import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { getWeekDates, today, CATEGORY_COLORS, kstDateKey } from "../utils/calendarUtils";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const HOUR_PX = 56;
const GUTTER_W = 34;
const DAY_MS = 24 * 60 * 60 * 1000;
const ALLDAY_H = 17;

const dayMidnightMs = (ds) => Date.parse(`${ds}T00:00:00+09:00`);
const dayNum = (ds) => Number(ds.split("-")[2]);

export default function WeekTimetable({ weekAnchor, events, selectedDate, onDayPress }) {
  const days = useMemo(() => getWeekDates(weekAnchor), [weekAnchor]);

  // 시간 일정: 요일별 블록 + 표시 시간 범위 계산
  const { timedByDay, startHour, endHour } = useMemo(() => {
    const timedByDay = {};
    let minMin = Infinity;
    let maxMin = -Infinity;

    days.forEach((ds) => {
      const mid = dayMidnightMs(ds);
      const dayEnd = mid + DAY_MS;
      timedByDay[ds] = [];
      events.forEach((ev) => {
        if (!ev?.startDate || ev.allDay) return;
        const s = Date.parse(ev.startDate);
        const e = Date.parse(ev.endDate || ev.startDate);
        if (isNaN(s) || e <= mid || s >= dayEnd) return;
        const startMin = Math.max(0, (s - mid) / 60000);
        const endMin = Math.min(1440, (e - mid) / 60000);
        if (endMin <= startMin) return;
        timedByDay[ds].push({ ev, startMin, endMin });
        minMin = Math.min(minMin, startMin);
        maxMin = Math.max(maxMin, endMin);
      });
    });

    let startHour = 9;
    let endHour = 18;
    if (minMin !== Infinity) {
      startHour = Math.max(0, Math.floor(minMin / 60));
      endHour = Math.min(24, Math.ceil(maxMin / 60));
      if (endHour - startHour < 4) endHour = Math.min(24, startHour + 4);
    }
    return { timedByDay, startHour, endHour };
  }, [days, events]);

  // 종일 일정: 주를 가로지르는 연속 막대 (레인 배치로 겹침 방지)
  const allDayBars = useMemo(() => {
    const first = days[0];
    const last = days[6];
    const spans = [];
    events.forEach((ev) => {
      if (!ev?.allDay || !ev?.startDate) return;
      const s = kstDateKey(ev.startDate);
      const e = ev.endDate ? kstDateKey(ev.endDate) : s;
      if (e < first || s > last) return;
      let startIdx = -1;
      let endIdx = -1;
      days.forEach((ds, i) => {
        if (ds >= s && ds <= e) {
          if (startIdx === -1) startIdx = i;
          endIdx = i;
        }
      });
      if (startIdx === -1) return;
      spans.push({ ev, startIdx, endIdx });
    });
    spans.sort((a, b) => a.startIdx - b.startIdx);
    const lanes = [];
    spans.forEach((span) => {
      let lane = 0;
      while (lanes[lane]?.some(r => !(span.endIdx < r[0] || span.startIdx > r[1]))) lane++;
      (lanes[lane] = lanes[lane] || []).push([span.startIdx, span.endIdx]);
      span.lane = lane;
    });
    return { spans, laneCount: lanes.length };
  }, [days, events]);

  const hours = [];
  for (let h = startHour; h < endHour; h++) hours.push(h);
  const gridHeight = (endHour - startHour) * HOUR_PX;

  return (
    <View style={s.wrap}>
      {/* 요일 헤더 */}
      <View style={s.headerRow}>
        <View style={{ width: GUTTER_W }} />
        {days.map((ds, i) => {
          const isToday = ds === today;
          const isSelected = ds === selectedDate;
          return (
            <TouchableOpacity
              key={ds}
              style={s.headerCell}
              activeOpacity={0.7}
              onPress={() => onDayPress(ds)}
            >
              <Text style={[s.dowText, i === 0 && s.sun, i === 6 && s.sat]}>{DOW[i]}</Text>
              <View style={[s.dateBadge, isToday && !isSelected && s.dateBadgeToday, isSelected && s.dateBadgeSel]}>
                <Text style={[
                  s.dateNum,
                  isSelected && s.dateNumSel,
                  isToday && !isSelected && s.dateNumToday,
                ]}>
                  {dayNum(ds)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 종일 일정 밴드 (주 가로지르는 연속 막대) */}
      {allDayBars.spans.length > 0 && (
        <View style={s.allDayRow}>
          <View style={[s.allDayLabelWrap, { width: GUTTER_W }]}>
            <Text style={s.allDayLabel}>종일</Text>
          </View>
          <View style={[s.allDayTrack, { height: allDayBars.laneCount * (ALLDAY_H + 2) }]}>
            {allDayBars.spans.map(({ ev, startIdx, endIdx, lane }) => (
              <TouchableOpacity
                key={ev._id}
                activeOpacity={0.7}
                onPress={() => onDayPress(days[startIdx])}
                style={[
                  s.allDayBar,
                  {
                    left: `${(startIdx / 7) * 100}%`,
                    width: `${((endIdx - startIdx + 1) / 7) * 100}%`,
                    top: lane * (ALLDAY_H + 2),
                    backgroundColor: CATEGORY_COLORS[ev.category] || "#4A90E2",
                  },
                ]}
              >
                <Text style={s.allDayChipText} numberOfLines={1}>{ev.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* 시간 그리드 */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        <View style={[s.grid, { height: gridHeight }]}>
          {/* 시간 눈금 라벨 + 가로선 */}
          <View style={{ width: GUTTER_W }}>
            {hours.map((h) => (
              <Text key={h} style={[s.hourLabel, { top: (h - startHour) * HOUR_PX - 6 }]}>
                {String(h).padStart(2, "0")}
              </Text>
            ))}
          </View>
          <View style={s.gridBody}>
            {hours.map((h) => (
              <View key={h} style={[s.hourLine, { top: (h - startHour) * HOUR_PX }]} />
            ))}
            <View style={s.dayCols}>
              {days.map((ds, i) => (
                <TouchableOpacity
                  key={ds}
                  style={[s.dayCol, i > 0 && s.dayColBorder, ds === selectedDate && s.dayColSelected]}
                  activeOpacity={1}
                  onPress={() => onDayPress(ds)}
                >
                  {timedByDay[ds].map(({ ev, startMin, endMin }) => {
                    const top = (startMin / 60 - startHour) * HOUR_PX;
                    const height = Math.max(16, ((endMin - startMin) / 60) * HOUR_PX);
                    return (
                      <View
                        key={ev._id}
                        style={[
                          s.block,
                          { top, height, backgroundColor: CATEGORY_COLORS[ev.category] || "#4A90E2" },
                        ]}
                      >
                        <Text style={s.blockText} numberOfLines={2}>{ev.title}</Text>
                      </View>
                    );
                  })}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fff" },
  headerRow: { flexDirection: "row", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: "#eee" },
  headerCell: { flex: 1, alignItems: "center", paddingVertical: 2 },
  dowText: { fontSize: 11, color: "#7f8c8d", fontWeight: "600", marginBottom: 3 },
  sun: { color: "#e74c3c" },
  sat: { color: "#4A90E2" },
  dateBadge: { width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  dateBadgeToday: { backgroundColor: "#e8f0fb" },
  dateBadgeSel: { backgroundColor: "#4A90E2" },
  dateNum: { fontSize: 13, color: "#2c3e50", fontWeight: "600" },
  dateNumSel: { color: "#fff", fontWeight: "700" },
  dateNumToday: { color: "#4A90E2", fontWeight: "700" },
  allDayRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee", paddingVertical: 3, minHeight: 24 },
  allDayLabelWrap: { justifyContent: "center", alignItems: "center" },
  allDayLabel: { fontSize: 9, color: "#aaa" },
  allDayTrack: { flex: 1, position: "relative" },
  allDayBar: { position: "absolute", height: ALLDAY_H, borderRadius: 3, paddingHorizontal: 4, justifyContent: "center" },
  allDayChipText: { fontSize: 9, color: "#fff", fontWeight: "600" },
  grid: { flexDirection: "row" },
  hourLabel: { position: "absolute", right: 4, fontSize: 10, color: "#aaa" },
  gridBody: { flex: 1, position: "relative" },
  hourLine: { position: "absolute", left: 0, right: 0, borderTopWidth: 1, borderTopColor: "#f0f0f0" },
  dayCols: { flexDirection: "row", flex: 1 },
  dayCol: { flex: 1, position: "relative" },
  dayColBorder: { borderLeftWidth: 1, borderLeftColor: "#f0f0f0" },
  dayColSelected: { backgroundColor: "#4a90e208" },
  block: { position: "absolute", left: 1, right: 1, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2, overflow: "hidden" },
  blockText: { fontSize: 9, color: "#fff", fontWeight: "600" },
});
