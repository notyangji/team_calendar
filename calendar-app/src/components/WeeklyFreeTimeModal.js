import React, { useState, useEffect, useMemo } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import client from "../api/client";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const HOUR_PX = 40;
const GUTTER_W = 30;
const FREE = "#27AE60";

const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// 숫자 입력을 HH:MM 으로 자동 변환 (예: 400 -> 04:00, 1800 -> 18:00)
const formatTime = (raw) => {
  const d = String(raw || "").replace(/\D/g, "").slice(0, 4);
  if (d.length === 4) return `${d.slice(0, 2)}:${d.slice(2)}`;
  if (d.length === 3) return `0${d[0]}:${d.slice(1)}`;
  if (d.length === 2) return `${d}:00`;
  if (d.length === 1) return `0${d}:00`;
  return raw;
};

export default function WeeklyFreeTimeModal({ visible, onClose, initial, onSaved }) {
  const [slots, setSlots] = useState([]);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ day: 1, start: "09:00", end: "18:00" });

  useEffect(() => {
    if (visible) {
      setSlots((initial || []).map(s => ({ day: s.day, start: s.start, end: s.end })));
      setAdding(false);
      setDraft({ day: 1, start: "09:00", end: "18:00" });
    }
  }, [visible, initial]);

  const { startHour, endHour, byDay } = useMemo(() => {
    let minH = 8, maxH = 22;
    const byDay = {};
    for (let d = 0; d < 7; d++) byDay[d] = [];
    slots.forEach((sl, idx) => {
      if (!TIME_RE.test(sl.start) || !TIME_RE.test(sl.end)) return;
      minH = Math.min(minH, Math.floor(toMin(sl.start) / 60));
      maxH = Math.max(maxH, Math.ceil(toMin(sl.end) / 60));
      byDay[sl.day]?.push({ ...sl, idx });
    });
    return { startHour: Math.max(0, minH), endHour: Math.min(24, maxH), byDay };
  }, [slots]);

  const hours = [];
  for (let h = startHour; h < endHour; h++) hours.push(h);
  const gridHeight = (endHour - startHour) * HOUR_PX;

  const removeSlot = (idx) =>
    Alert.alert("여유 시간 삭제", "이 시간대를 삭제할까요?", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => setSlots(prev => prev.filter((_, i) => i !== idx)) },
    ]);

  const confirmAdd = () => {
    const start = formatTime(draft.start);
    const end = formatTime(draft.end);
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
      return Alert.alert("알림", "시간 형식이 올바르지 않습니다.\n예: 09:00");
    }
    if (start >= end) {
      return Alert.alert("알림", "종료 시간이 시작 시간보다 늦어야 합니다.");
    }
    setSlots(prev => [...prev, { day: draft.day, start, end }]);
    setAdding(false);
    setDraft({ day: 1, start: "09:00", end: "18:00" });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await client.put("/auth/me", { weeklyFreeTime: slots });
      onSaved?.(data.weeklyFreeTime || []);
      onClose();
    } catch (e) {
      Alert.alert("오류", e?.response?.data?.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>주간 여유 시간</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#7f8c8d" />
            </TouchableOpacity>
          </View>

          {/* 추가 패널 (키보드가 가리지 않도록 상단 배치) */}
          {adding && (
            <View style={s.addPanel}>
              <View style={s.dayChips}>
                {DOW.map((d, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.dayChip, draft.day === i && s.dayChipActive]}
                    onPress={() => setDraft(p => ({ ...p, day: i }))}
                  >
                    <Text style={[s.dayChipText, draft.day === i && s.dayChipTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.timeRow}>
                <TextInput
                  style={s.timeInput}
                  value={draft.start}
                  onChangeText={t => setDraft(p => ({ ...p, start: t }))}
                  onBlur={() => setDraft(p => ({ ...p, start: formatTime(p.start) }))}
                  placeholder="09:00"
                  keyboardType="number-pad"
                  maxLength={5}
                />
                <Text style={s.tilde}>~</Text>
                <TextInput
                  style={s.timeInput}
                  value={draft.end}
                  onChangeText={t => setDraft(p => ({ ...p, end: t }))}
                  onBlur={() => setDraft(p => ({ ...p, end: formatTime(p.end) }))}
                  placeholder="18:00"
                  keyboardType="number-pad"
                  maxLength={5}
                />
                <TouchableOpacity style={s.cancelMini} onPress={() => setAdding(false)}>
                  <Text style={s.cancelMiniText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.confirmMini} onPress={confirmAdd}>
                  <Text style={s.confirmMiniText}>추가</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 요일 헤더 */}
          <View style={s.dowRow}>
            <View style={{ width: GUTTER_W }} />
            {DOW.map((d, i) => (
              <Text key={i} style={[s.dowText, i === 0 && s.sun, i === 6 && s.sat]}>{d}</Text>
            ))}
          </View>

          {/* 시간표 그리드 */}
          <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
            <View style={[s.grid, { height: gridHeight }]}>
              <View style={{ width: GUTTER_W }}>
                {hours.map(h => (
                  <Text key={h} style={[s.hourLabel, { top: (h - startHour) * HOUR_PX - 6 }]}>
                    {String(h).padStart(2, "0")}
                  </Text>
                ))}
              </View>
              <View style={s.gridBody}>
                {hours.map(h => (
                  <View key={h} style={[s.hourLine, { top: (h - startHour) * HOUR_PX }]} />
                ))}
                <View style={s.dayCols}>
                  {DOW.map((_, d) => (
                    <View key={d} style={[s.dayCol, d > 0 && s.dayColBorder]}>
                      {byDay[d].map((sl) => {
                        const top = (toMin(sl.start) / 60 - startHour) * HOUR_PX;
                        const height = Math.max(14, (toMin(sl.end) - toMin(sl.start)) / 60 * HOUR_PX);
                        return (
                          <TouchableOpacity
                            key={sl.idx}
                            style={[s.block, { top, height }]}
                            activeOpacity={0.7}
                            onPress={() => removeSlot(sl.idx)}
                          >
                            <Text style={s.blockText} numberOfLines={2}>{sl.start}~{sl.end}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>

          {!adding && (
            <TouchableOpacity style={s.addBtn} onPress={() => setAdding(true)}>
              <Ionicons name="add" size={18} color={FREE} />
              <Text style={s.addText}>여유시간 추가</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>저장</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 17, fontWeight: "bold", color: "#2c3e50" },
  dowRow: { flexDirection: "row", paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#eee" },
  dowText: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: "#7f8c8d" },
  sun: { color: "#e74c3c" },
  sat: { color: "#4A90E2" },
  grid: { flexDirection: "row" },
  hourLabel: { position: "absolute", right: 4, fontSize: 10, color: "#aaa" },
  gridBody: { flex: 1, position: "relative" },
  hourLine: { position: "absolute", left: 0, right: 0, borderTopWidth: 1, borderTopColor: "#f0f0f0" },
  dayCols: { flexDirection: "row", flex: 1 },
  dayCol: { flex: 1, position: "relative" },
  dayColBorder: { borderLeftWidth: 1, borderLeftColor: "#f0f0f0" },
  block: { position: "absolute", left: 1, right: 1, borderRadius: 4, backgroundColor: FREE, paddingHorizontal: 2, justifyContent: "center" },
  blockText: { fontSize: 8, color: "#fff", fontWeight: "600", textAlign: "center" },
  addPanel: { marginTop: 14, padding: 10, backgroundColor: "#f8f9fa", borderRadius: 10 },
  dayChips: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  dayChip: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e0e0e0", justifyContent: "center", alignItems: "center" },
  dayChipActive: { backgroundColor: FREE, borderColor: FREE },
  dayChipText: { fontSize: 13, color: "#7f8c8d", fontWeight: "600" },
  dayChipTextActive: { color: "#fff", fontWeight: "700" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  timeInput: { flex: 1, height: 38, borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 8, paddingHorizontal: 8, fontSize: 14, color: "#2c3e50", textAlign: "center", backgroundColor: "#fff" },
  tilde: { fontSize: 14, color: "#7f8c8d" },
  cancelMini: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, backgroundColor: "#eee" },
  cancelMiniText: { fontSize: 13, color: "#7f8c8d", fontWeight: "600" },
  confirmMini: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, backgroundColor: FREE },
  confirmMiniText: { fontSize: 13, color: "#fff", fontWeight: "700" },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    paddingVertical: 12, marginTop: 14, borderRadius: 8, borderWidth: 1,
    borderColor: FREE, borderStyle: "dashed",
  },
  addText: { color: FREE, fontSize: 14, fontWeight: "600" },
  saveBtn: { backgroundColor: "#4A90E2", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
