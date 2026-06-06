import React, { useState, useEffect, useCallback } from "react";
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator,
  ScrollView, StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import client from "../api/client";

const HOUR_START = 8;
const HOUR_END   = 22;
const TOTAL_MIN  = (HOUR_END - HOUR_START) * 60;

function toHHMM(isoStr) {
  const d = new Date(isoStr);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function toPercent(isoStr) {
  const d    = new Date(isoStr);
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes() - HOUR_START * 60;
  return Math.max(0, Math.min(100, (mins / TOTAL_MIN) * 100));
}

function toDurationPercent(startIso, endIso) {
  const diffMin = (new Date(endIso) - new Date(startIso)) / 60000;
  return Math.min(100, (diffMin / TOTAL_MIN) * 100);
}

export default function FreeBusyModal({
  visible,
  onClose,
  teamId,
  date,            // "YYYY-MM-DD"
  selectedUserIds, // string[] | ObjectId[]
}) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetchFreeBusy = useCallback(async () => {
    if (!teamId || !date) return;
    setLoading(true);
    setError(null);
    try {
      const params = { teamId, date };
      if (selectedUserIds?.length) {
        // Bug4 fix: normalize ObjectId → string
        params.userIds = selectedUserIds
          .map(id => (typeof id === "object" ? id.toString() : id))
          .join(",");
      }
      const { data: res } = await client.get("/events/free-busy", { params });
      setData(res);
    } catch (e) {
      setError(e?.response?.data?.message || "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [teamId, date, selectedUserIds]);

  useEffect(() => {
    if (visible) fetchFreeBusy();
  }, [visible, fetchFreeBusy]);

  const hourLabels = Array.from(
    { length: HOUR_END - HOUR_START + 1 },
    (_, i) => HOUR_START + i
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>여유 시간 확인</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#2c3e50" />
            </TouchableOpacity>
          </View>

          <Text style={s.dateLabel}>{date}</Text>

          {loading && (
            <View style={s.center}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={s.loadingText}>불러오는 중...</Text>
            </View>
          )}

          {error && (
            <View style={s.center}>
              <Text style={s.errorText}>{error}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={fetchFreeBusy}>
                <Text style={s.retryText}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          )}

          {data && !loading && (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* 공통 여유 시간 */}
              {data.freeSlots?.length > 0 ? (
                <View style={s.freeSlotsWrap}>
                  <Text style={s.freeSlotsLabel}>
                    모두 비는 시간
                  </Text>
                  <View style={s.freeChips}>
                    {data.freeSlots.map((slot, i) => (
                      <View key={i} style={s.freeChip}>
                        <Text style={s.freeChipText}>
                          {toHHMM(slot.start)} – {toHHMM(slot.end)}
                        </Text>
                        <Text style={s.freeChipDur}>{slot.durationMin}분</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={s.noFreeWrap}>
                  <Ionicons name="alert-circle-outline" size={16} color="#e74c3c" />
                  <Text style={s.noFreeText}>공통 여유 시간이 없습니다.</Text>
                </View>
              )}

              {/* 시간 눈금 */}
              <View style={s.timelineHeader}>
                <View style={s.nameCol} />
                <View style={s.barCol}>
                  <View style={s.hourLabels}>
                    {hourLabels.map(h => (
                      <Text key={h} style={s.hourLabel}>
                        {String(h).padStart(2, "0")}
                      </Text>
                    ))}
                  </View>
                </View>
              </View>

              {/* 멤버별 타임라인 */}
              {data.members.map((member) => (
                <View key={String(member.userId)} style={s.memberRow}>
                  <View style={s.nameCol}>
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>
                        {member.name?.[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={s.memberName} numberOfLines={1}>
                      {member.name}
                    </Text>
                  </View>

                  <View style={s.barCol}>
                    <View style={s.bar}>
                      {data.freeSlots.map((slot, i) => (
                        <View
                          key={`free-${i}`}
                          style={[s.freeOverlay, {
                            left:  `${toPercent(slot.start)}%`,
                            width: `${toDurationPercent(slot.start, slot.end)}%`,
                          }]}
                        />
                      ))}
                      {member.busySlots.map((slot, i) => (
                        <View
                          key={`busy-${i}`}
                          style={[s.busyBlock, {
                            left:  `${toPercent(slot.start)}%`,
                            width: `${toDurationPercent(slot.start, slot.end)}%`,
                          }]}
                        />
                      ))}
                    </View>
                  </View>
                </View>
              ))}

              {/* 범례 */}
              <View style={s.legend}>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: "#4A90E2" }]} />
                  <Text style={s.legendText}>바쁨</Text>
                </View>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: "#27AE6033" }]} />
                  <Text style={s.legendText}>모두 여유</Text>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%", paddingBottom: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" },
  title: { fontSize: 17, fontWeight: "600", color: "#2c3e50" },
  dateLabel: { fontSize: 13, color: "#7f8c8d", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  center: { alignItems: "center", paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, color: "#7f8c8d" },
  errorText: { fontSize: 14, color: "#e74c3c" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: "#4A90E2", borderRadius: 8 },
  retryText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  freeSlotsWrap: { marginHorizontal: 16, marginVertical: 12, padding: 12, backgroundColor: "#f0faf4", borderRadius: 10, borderWidth: 0.5, borderColor: "#b7e4c7" },
  freeSlotsLabel: { fontSize: 12, fontWeight: "600", color: "#27AE60", marginBottom: 8 },
  freeChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  freeChip: { backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#27AE60", alignItems: "center" },
  freeChipText: { fontSize: 13, fontWeight: "500", color: "#2c3e50" },
  freeChipDur: { fontSize: 10, color: "#7f8c8d", marginTop: 1 },
  noFreeWrap: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 16, marginVertical: 12, padding: 12, backgroundColor: "#fef0f0", borderRadius: 10, borderWidth: 0.5, borderColor: "#f5c6c6" },
  noFreeText: { fontSize: 13, color: "#e74c3c" },
  timelineHeader: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 4 },
  nameCol: { width: 60, alignItems: "center" },
  barCol: { flex: 1 },
  hourLabels: { flexDirection: "row", justifyContent: "space-between" },
  hourLabel: { fontSize: 9, color: "#bbb" },
  memberRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 10 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#4A90E2", alignItems: "center", justifyContent: "center", marginBottom: 2 },
  avatarText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  memberName: { fontSize: 10, color: "#2c3e50", textAlign: "center", width: 60 },
  bar: { flex: 1, height: 28, backgroundColor: "#f0f0f0", borderRadius: 6, overflow: "hidden", position: "relative" },
  freeOverlay: { position: "absolute", top: 0, bottom: 0, backgroundColor: "#27AE6033" },
  busyBlock: { position: "absolute", top: 2, bottom: 2, backgroundColor: "#4A90E2", borderRadius: 4 },
  legend: { flexDirection: "row", gap: 16, justifyContent: "center", marginTop: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 12, color: "#7f8c8d" },
});