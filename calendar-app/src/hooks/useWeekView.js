import { useRef, useMemo, useState, useCallback } from "react";
import { PanResponder } from "react-native";
import { addDays, getWeekDates } from "../utils/calendarUtils";

export default function useWeekView(selectedDate, setSelectedDate) {
  const [viewMode, setViewMode] = useState("month"); // "month" | "week"

  const goPrevWeek = useCallback(() => setSelectedDate(d => addDays(d, -7)), [setSelectedDate]);
  const goNextWeek = useCallback(() => setSelectedDate(d => addDays(d, 7)), [setSelectedDate]);

  const weekSwipeHandlers = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20,
      onPanResponderRelease: (_, { dx }) => {
        if (Math.abs(dx) < 50) return;
        setSelectedDate(d => addDays(d, dx < 0 ? 7 : -7));
      },
    })
  ).current.panHandlers;

  const weekLabel = useMemo(() => {
    const [y, m] = getWeekDates(selectedDate)[3].split("-");
    return `${y}년 ${Number(m)}월`;
  }, [selectedDate]);

  return { viewMode, setViewMode, weekSwipeHandlers, weekLabel, goPrevWeek, goNextWeek };
}
