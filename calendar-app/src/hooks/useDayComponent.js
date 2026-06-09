import { useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { today, CATEGORY_COLORS, filterDayEvents, kstDateKey } from "../utils/calendarUtils";

export default function useDayComponent(events, selectedDate, onDayPress) {
  return useCallback(({ date, state }) => {
    if (!date) return <View style={s.cell} />;
    const dayEvs = filterDayEvents(events, date.dateString);
    const isSelected = date.dateString === selectedDate;
    const isToday = date.dateString === today;
    const isOtherMonth = state === "disabled";
    const dow = new Date(date.dateString + "T12:00:00Z").getUTCDay();

    return (
      <TouchableOpacity
        style={s.cell}
        onPress={() => !isOtherMonth && onDayPress({ dateString: date.dateString })}
        activeOpacity={0.7}
      >
        <View style={[
          s.numWrap,
          isToday && !isSelected && s.numToday,
          isSelected && s.numSelected,
        ]}>
          <Text style={[
            s.num,
            isOtherMonth && s.numOther,
            isSelected && s.numSelectedText,
            isToday && !isSelected && s.numTodayText,
            !isSelected && !isToday && !isOtherMonth && dow === 0 && s.numSun,
            !isSelected && !isToday && !isOtherMonth && dow === 6 && s.numSat,
          ]}>
            {date.day}
          </Text>
        </View>
        <View style={s.bars}>
          {dayEvs.slice(0, 3).map(ev => {
            const evStart = ev?.startDate ? kstDateKey(ev.startDate) : undefined;
            const evEnd = (ev?.endDate ? kstDateKey(ev.endDate) : undefined) || evStart;
            // 주 행 경계(일요일=시작, 토요일=끝)도 시각적 시작/끝으로 처리
            const isVisualStart = date.dateString === evStart || dow === 0;
            const isVisualEnd = date.dateString === evEnd || dow === 6;
            return (
              <View
                key={ev._id}
                style={[
                  s.bar,
                  { backgroundColor: CATEGORY_COLORS[ev.category] || "#4A90E2" },
                  !isVisualStart && { borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginLeft: -1 },
                  !isVisualEnd && { borderTopRightRadius: 0, borderBottomRightRadius: 0, marginRight: -1 },
                ]}
              >
                {isVisualStart
                  ? <Text style={s.barText} numberOfLines={1}>{ev.title}</Text>
                  : <Text style={s.barTextHidden}> </Text>
                }
              </View>
            );
          })}
          {dayEvs.length > 3 && (
            <Text style={s.more}>+{dayEvs.length - 3}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [events, selectedDate, onDayPress]);
}

const s = StyleSheet.create({
  cell: { width: "100%", minHeight: 62, paddingBottom: 4, alignItems: "center" },
  numWrap: { width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center", marginBottom: 2 },
  numToday: { backgroundColor: "#e8f0fb" },
  numSelected: { backgroundColor: "#4A90E2" },
  num: { fontSize: 13, color: "#2c3e50", fontWeight: "500" },
  numOther: { color: "#ccc" },
  numSelectedText: { color: "#fff", fontWeight: "700" },
  numTodayText: { color: "#4A90E2", fontWeight: "700" },
  numSun: { color: "#e74c3c" },
  numSat: { color: "#4A90E2" },
  bars: { width: "100%", gap: 1 },
  bar: { borderRadius: 3, height: 15, paddingHorizontal: 3, justifyContent: "center" },
  barText: { fontSize: 9, color: "#fff", fontWeight: "500" },
  barTextHidden: { fontSize: 9, color: "transparent" },
  more: { fontSize: 9, color: "#7f8c8d", marginTop: 1, alignSelf: "flex-start", paddingHorizontal: 3 },
});
