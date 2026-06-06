import { Dimensions } from "react-native";
import { LocaleConfig } from "react-native-calendars";

const { height: SCREEN_H } = Dimensions.get("window");
export const SHEET_COLLAPSED = 76;
export const SHEET_EXPANDED = Math.min(Math.round(SCREEN_H * 0.25), 220);
export const SHEET_MAX = Math.min(Math.round(SCREEN_H * 0.5), 420);

LocaleConfig.locales["ko"] = {
  monthNames: ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"],
  monthNamesShort: ["1","2","3","4","5","6","7","8","9","10","11","12"],
  dayNames: ["일요일","월요일","화요일","수요일","목요일","금요일","토요일"],
  dayNamesShort: ["일","월","화","수","목","금","토"],
};
LocaleConfig.defaultLocale = "ko";

const KST_MS = 9 * 60 * 60 * 1000;
const kst = (iso) => new Date(new Date(iso).getTime() + KST_MS);
export const kstDateKey = (iso) => kst(iso).toISOString().split("T")[0];
export const kstHHMM = (iso) => kst(iso).toISOString().split("T")[1].slice(0, 5);
export const kstTodayKey = () => kstDateKey(new Date().toISOString());
export const kstToUtcISO = (dateStr, timeStr = "00:00", sec = 0) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, sec) - KST_MS).toISOString();
};

export const today = kstTodayKey();

export const CATEGORY_COLORS = {
  work: "#4A90E2", meeting: "#9B59B6", outdoor: "#27AE60",
  vacation: "#F39C12", deadline: "#E74C3C", personal: "#1ABC9C",
};

export const formatTimeKr = (isoDate) => {
  const t = isoDate ? kstHHMM(isoDate) : null;
  if (!t) return "시간 미설정";
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${ampm} ${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const buildPeriodMarks = (events, selectedDate) => {
  const marks = {};
  events.forEach(ev => {
    try {
      const start = ev?.startDate ? kstDateKey(ev.startDate) : undefined;
      const end = (ev?.endDate ? kstDateKey(ev.endDate) : undefined) || start;
      if (!start) return;
      const color = CATEGORY_COLORS[ev.category] || "#4A90E2";
      let cur = start;
      let safety = 0;
      while (cur <= end && safety++ < 366) {
        const mark = { color };
        if (cur === start) mark.startingDay = true;
        if (cur === end) mark.endingDay = true;
        marks[cur] = { ...(marks[cur] || {}), ...mark };
        const d = new Date(cur + "T12:00:00.000Z");
        d.setUTCDate(d.getUTCDate() + 1);
        cur = d.toISOString().split("T")[0];
      }
    } catch {}
  });
  const selColor = marks[selectedDate]?.color || "#4A90E2";
  marks[selectedDate] = {
    ...(marks[selectedDate] || {}),
    color: selColor,
    startingDay: marks[selectedDate]?.startingDay ?? true,
    endingDay: marks[selectedDate]?.endingDay ?? true,
    selected: true,
    selectedColor: selColor,
  };
  return marks;
};

export const filterDayEvents = (events, selectedDate) => {
  return events.filter(e => {
    try {
      const start = e?.startDate ? kstDateKey(e.startDate) : undefined;
      const end = (e?.endDate ? kstDateKey(e.endDate) : undefined) || start;
      return start && selectedDate >= start && selectedDate <= end;
    } catch { return false; }
  });
};
