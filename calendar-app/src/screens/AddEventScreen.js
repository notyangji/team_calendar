import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Switch,
  KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import client from "../api/client";
import FreeBusyModal from "../components/FreeBusyModal";

// 分类配置
const CATEGORIES = [
  { value: "work", label: "작업", color: "#4A90E2" },
  { value: "meeting", label: "회의", color: "#9B59B6" },
  { value: "outdoor", label: "외근", color: "#27AE60" },
  { value: "vacation", label: "휴가", color: "#F39C12" },
  { value: "deadline", label: "마감", color: "#E74C3C" },
  { value: "personal", label: "개인", color: "#1ABC9C" },
];

// 提醒选项
const REMINDER_OPTIONS = [
  { value: 5, label: "5분 전" },
  { value: 10, label: "10분 전" },
  { value: 15, label: "15분 전" },
  { value: 30, label: "30분 전" },
  { value: 60, label: "1시간 전" },
  { value: 1440, label: "1일 전" },
];

const formatDate = (raw) => {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
};

const formatTime = (raw) => {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
};

const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s));

const nextDay = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
};

function parseDate(iso) { return iso?.split("T")[0] ?? ""; }
function parseTime(iso) { return iso?.split("T")[1]?.slice(0, 5) ?? ""; }

const to12hDisplay = (t) => {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr) || 0;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(h12).padStart(2, "0")}:${mStr || "00"}`;
};
const getAmPm = (t) => parseInt(t.split(":")[0]) < 12 ? "오전" : "오후";
const from12hToTime24 = (input12, ampm) => {
  const [hStr, mStr] = input12.split(":");
  const h = parseInt(hStr) || 12;
  const m = Math.min(parseInt(mStr) || 0, 59);
  let h24 = h % 12;
  if (ampm === "오후") h24 += 12;
  return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export default function AddEventScreen({ navigation, route }) {
  const existingEvent = route.params?.event ?? null;
  const initialDate = route.params?.selectedDate ?? new Date().toISOString().split("T")[0];
  const teamId = route.params?.teamId ?? null;
  const isEdit = existingEvent !== null;

  // 基础字段
  const [title, setTitle] = useState(existingEvent?.title ?? "");
  const [description, setDescription] = useState(existingEvent?.description ?? "");
  const [startDate, setStartDate] = useState(isEdit ? parseDate(existingEvent.startDate) : initialDate);
  const [endDate, setEndDate] = useState(isEdit ? parseDate(existingEvent.endDate) : initialDate);

  const _initStartTime = isEdit ? parseTime(existingEvent.startDate) : "09:00";
  const _initEndTime = isEdit ? parseTime(existingEvent.endDate) : "10:00";
  const [startTime, setStartTime] = useState(_initStartTime);
  const [startTimeInput, setStartTimeInput] = useState(to12hDisplay(_initStartTime));
  const [startAmPm, setStartAmPm] = useState(getAmPm(_initStartTime));
  const [endTime, setEndTime] = useState(_initEndTime);
  const [endTimeInput, setEndTimeInput] = useState(to12hDisplay(_initEndTime));
  const [endAmPm, setEndAmPm] = useState(getAmPm(_initEndTime));
  const [allDay, setAllDay] = useState(existingEvent?.allDay ?? false);
  const [loading, setLoading] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState("start");

  // 新增字段
  const [category, setCategory] = useState(existingEvent?.category ?? "personal");
  const [tags, setTags] = useState(existingEvent?.tags?.join(", ") ?? "");
  const [location, setLocation] = useState(existingEvent?.location ?? "");
  
  // 提醒设置
  const [reminderEnabled, setReminderEnabled] = useState(existingEvent?.reminder?.enabled ?? false);
  const [reminderMinutes, setReminderMinutes] = useState(existingEvent?.reminder?.minutes ?? 30);
  
  // 参与人
  const [attendees, setAttendees] = useState(existingEvent?.attendees?.map(a => a.userId?._id || a.userId) ?? []);
  const [teamMembers, setTeamMembers] = useState([]);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showFreeBusy, setShowFreeBusy] = useState(false);
  
  // 分类选择弹窗
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  // 提醒选择弹窗
  const [showReminderModal, setShowReminderModal] = useState(false);

  // 获取团队成员列表
  useEffect(() => {
    if (teamId) {
      fetchTeamMembers();
    }
  }, [teamId]);

  const fetchTeamMembers = async () => {
    try {
      const { data } = await client.get(`/teams/${teamId}`);
      const ownerId = data.owner?._id || data.owner;
      const list = (data.members || []).map(m => {
        const memberId = m._id || m;
        const memberIdStr = String(memberId);
        let role = "member";
        if (String(ownerId) === memberIdStr) role = "owner";
        else if (data.memberRoles?.[memberIdStr]) role = data.memberRoles[memberIdStr];
        return { _id: memberId, name: m.name || "알 수 없음", email: m.email || "", role };
      });
      setTeamMembers(list);
    } catch (e) {
      console.error("팀 멤버 불러오기 실패:", e);
    }
  };

  const handleStartTimeInput = (raw) => {
    const formatted = formatTime(raw);
    setStartTimeInput(formatted);
    if (/^\d{2}:\d{2}$/.test(formatted)) setStartTime(from12hToTime24(formatted, startAmPm));
  };
  const handleStartAmPm = (newAmPm) => {
    setStartAmPm(newAmPm);
    if (/^\d{2}:\d{2}$/.test(startTimeInput)) setStartTime(from12hToTime24(startTimeInput, newAmPm));
  };
  const handleEndTimeInput = (raw) => {
    const formatted = formatTime(raw);
    setEndTimeInput(formatted);
    if (/^\d{2}:\d{2}$/.test(formatted)) setEndTime(from12hToTime24(formatted, endAmPm));
  };
  const handleEndAmPm = (newAmPm) => {
    setEndAmPm(newAmPm);
    if (/^\d{2}:\d{2}$/.test(endTimeInput)) setEndTime(from12hToTime24(endTimeInput, newAmPm));
  };

  // 分类颜色
  const categoryColor = CATEGORIES.find(c => c.value === category)?.color || "#4A90E2";

  const calendarInitialDate = useRef(
    isValidDate(startDate) ? startDate : new Date().toISOString().split("T")[0]
  ).current;

  const calendarMarked = useMemo(() => {
    const marks = {};
    if (!isValidDate(startDate)) return marks;
    if (!isValidDate(endDate) || startDate === endDate || startDate > endDate) {
      marks[startDate] = { startingDay: true, endingDay: true, color: categoryColor, textColor: "#fff" };
      return marks;
    }
    marks[startDate] = { startingDay: true, color: categoryColor, textColor: "#fff" };
    marks[endDate] = { endingDay: true, color: categoryColor, textColor: "#fff" };
    let cur = nextDay(startDate);
    while (cur < endDate) {
      marks[cur] = { color: `${categoryColor}40`, textColor: "#2c3e50" };
      cur = nextDay(cur);
    }
    return marks;
  }, [startDate, endDate, categoryColor]);

  const handleCalendarDayPress = (day) => {
    if (calendarTarget === "start") {
      setStartDate(day.dateString);
      if (endDate && day.dateString > endDate) setEndDate(day.dateString);
      setCalendarTarget("end");
    } else {
      if (day.dateString < startDate) {
        setStartDate(day.dateString);
        setCalendarTarget("end");
      } else {
        setEndDate(day.dateString);
      }
    }
  };

  const toggleAttendee = (userId) => {
    setAttendees(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert("알림", "제목을 입력해주세요.");
    if (!isValidDate(startDate) || !isValidDate(endDate))
      return Alert.alert("알림", "날짜 형식이 올바르지 않습니다.\n예: 2026-05-21");

    const startISO = allDay ? `${startDate}T00:00:00.000Z` : `${startDate}T${startTime}:00.000Z`;
    const endISO = allDay ? `${endDate}T23:59:59.000Z` : `${endDate}T${endTime}:00.000Z`;

    if (new Date(startISO) > new Date(endISO))
      return Alert.alert("알림", "종료 시간이 시작 시간보다 빠를 수 없습니다.");

    setLoading(true);
    try {
      const eventData = {
        title: title.trim(),
        description: description.trim(),
        startDate: startISO,
        endDate: endISO,
        allDay,
        category,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        location: location.trim(),
        reminder: { enabled: reminderEnabled, minutes: reminderMinutes },
        teamId,
        attendees: attendees.map(id => ({ userId: id })),
      };

      if (isEdit) {
        await client.put(`/events/${existingEvent._id}`, eventData);
      } else {
        await client.post("/events", eventData);
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert("오류", e?.response?.data?.message || e?.message || "일정을 저장하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = CATEGORIES.find(c => c.value === category);
  const selectedReminder = REMINDER_OPTIONS.find(r => r.value === reminderMinutes);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? "일정 수정" : "새 일정"}</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color="#4A90E2" />
              : <Text style={styles.saveText}>저장</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          {/* 标题 */}
          <TextInput
            style={styles.titleInput}
            placeholder="제목"
            placeholderTextColor="#aaa"
            value={title}
            onChangeText={setTitle}
          />

          {/* 描述 */}
          <TextInput
            style={styles.descInput}
            placeholder="메모 (선택)"
            placeholderTextColor="#aaa"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {/* 分类选择 */}
          <TouchableOpacity style={styles.optionRow} onPress={() => setShowCategoryModal(true)}>
            <View style={styles.optionLeft}>
              <View style={[styles.categoryDot, { backgroundColor: selectedCategory?.color }]} />
              <Text style={styles.optionLabel}>분류</Text>
            </View>
            <View style={styles.optionRight}>
              <Text style={[styles.optionValue, { color: selectedCategory?.color }]}>
                {selectedCategory?.label}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#aaa" />
            </View>
          </TouchableOpacity>

          {/* 地点 */}
          <View style={styles.inputRow}>
            <Ionicons name="location-outline" size={20} color="#7f8c8d" />
            <TextInput
              style={styles.locationInput}
              placeholder="장소 (선택)"
              placeholderTextColor="#aaa"
              value={location}
              onChangeText={setLocation}
            />
          </View>

          {/* 标签 */}
          <View style={styles.inputRow}>
            <Ionicons name="pricetag-outline" size={20} color="#7f8c8d" />
            <TextInput
              style={styles.locationInput}
              placeholder="태그 (쉼표로 구분, 예: 중요, 기획)"
              placeholderTextColor="#aaa"
              value={tags}
              onChangeText={setTags}
            />
          </View>

          {/* 全天开关 */}
          <View style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Ionicons name="time-outline" size={20} color="#7f8c8d" />
              <Text style={styles.optionLabel}>하루 종일</Text>
            </View>
            <Switch value={allDay} onValueChange={setAllDay} trackColor={{ true: "#4A90E2" }} />
          </View>

          {/* 시작 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>시작</Text>
            <TextInput
              style={[styles.dateInput, styles.dateInputFull, calendarTarget === "start" && styles.dateInputActive]}
              value={startDate}
              onChangeText={(t) => setStartDate(formatDate(t))}
              onFocus={() => setCalendarTarget("start")}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#aaa"
              keyboardType="number-pad"
              maxLength={10}
            />
            {!allDay && (
              <View style={styles.timeRow}>
                <TextInput
                  style={[styles.dateInput, styles.timeInputField]}
                  value={startTimeInput}
                  onChangeText={handleStartTimeInput}
                  placeholder="12:00"
                  placeholderTextColor="#aaa"
                  keyboardType="number-pad"
                  maxLength={5}
                />
                <TouchableOpacity
                  style={[styles.ampmBtn, startAmPm === "오전" && styles.ampmBtnActive]}
                  onPress={() => handleStartAmPm("오전")}
                >
                  <Text style={[styles.ampmBtnText, startAmPm === "오전" && styles.ampmBtnTextActive]}>오전</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ampmBtn, startAmPm === "오후" && styles.ampmBtnActive]}
                  onPress={() => handleStartAmPm("오후")}
                >
                  <Text style={[styles.ampmBtnText, startAmPm === "오후" && styles.ampmBtnTextActive]}>오후</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 종료 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>종료</Text>
            <TextInput
              style={[styles.dateInput, styles.dateInputFull, calendarTarget === "end" && styles.dateInputActive]}
              value={endDate}
              onChangeText={(t) => setEndDate(formatDate(t))}
              onFocus={() => setCalendarTarget("end")}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#aaa"
              keyboardType="number-pad"
              maxLength={10}
            />
            {!allDay && (
              <View style={styles.timeRow}>
                <TextInput
                  style={[styles.dateInput, styles.timeInputField]}
                  value={endTimeInput}
                  onChangeText={handleEndTimeInput}
                  placeholder="12:00"
                  placeholderTextColor="#aaa"
                  keyboardType="number-pad"
                  maxLength={5}
                />
                <TouchableOpacity
                  style={[styles.ampmBtn, endAmPm === "오전" && styles.ampmBtnActive]}
                  onPress={() => handleEndAmPm("오전")}
                >
                  <Text style={[styles.ampmBtnText, endAmPm === "오전" && styles.ampmBtnTextActive]}>오전</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ampmBtn, endAmPm === "오후" && styles.ampmBtnActive]}
                  onPress={() => handleEndAmPm("오후")}
                >
                  <Text style={[styles.ampmBtnText, endAmPm === "오후" && styles.ampmBtnTextActive]}>오후</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 提醒设置 */}
          <TouchableOpacity style={styles.optionRow} onPress={() => setShowReminderModal(true)}>
            <View style={styles.optionLeft}>
              <Ionicons name="notifications-outline" size={20} color="#7f8c8d" />
              <Text style={styles.optionLabel}>알림</Text>
            </View>
            <View style={styles.optionRight}>
              <Text style={styles.optionValue}>
                {reminderEnabled ? selectedReminder?.label : "끄기"}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#aaa" />
            </View>
          </TouchableOpacity>

          {/* 参与人选择 */}
          {teamId && teamMembers.length > 0 && (
            <TouchableOpacity style={styles.optionRow} onPress={() => setShowAttendeeModal(true)}>
              <View style={styles.optionLeft}>
                <Ionicons name="people-outline" size={20} color="#7f8c8d" />
                <Text style={styles.optionLabel}>참여자</Text>
              </View>
              <View style={styles.optionRight}>
                <Text style={styles.optionValue}>
                  {attendees.length > 0 ? `${attendees.length}명 선택됨` : "선택"}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#aaa" />
              </View>
            </TouchableOpacity>
          )}
          {teamId && teamMembers.length > 0 && (
            <TouchableOpacity
             style={[styles.optionRow, { borderColor: "#27AE60" }]}
             onPress={() => setShowFreeBusy(true)}
            >
              <View style={styles.optionLeft}>
                <Ionicons name="time-outline" size={20} color="#27AE60" />
                <Text style={[styles.optionLabel, { color: "#27AE60" }]}>여유 시간 확인</Text>
              </View>
                <Ionicons name="chevron-forward" size={18} color="#27AE60" />
                 </TouchableOpacity>
          )}
          {/* 日历 */}
          <View style={styles.calendarCard}>
            <View style={styles.calendarTabs}>
              <TouchableOpacity
                style={[styles.calendarTab, calendarTarget === "start" && styles.calendarTabActive]}
                onPress={() => setCalendarTarget("start")}
              >
                <Text style={[styles.calendarTabText, calendarTarget === "start" && styles.calendarTabTextActive]}>
                  시작일
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.calendarTab, calendarTarget === "end" && styles.calendarTabActive]}
                onPress={() => setCalendarTarget("end")}
              >
                <Text style={[styles.calendarTabText, calendarTarget === "end" && styles.calendarTabTextActive]}>
                  종료일
                </Text>
              </TouchableOpacity>
            </View>
            <Calendar
              current={calendarInitialDate}
              onDayPress={handleCalendarDayPress}
              markedDates={calendarMarked}
              markingType="period"
              theme={{
                todayTextColor: "#4A90E2",
                arrowColor: "#4A90E2",
                textDayFontSize: 14,
                textMonthFontSize: 15,
                textMonthFontWeight: "bold",
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 分类选择弹窗 */}
      <Modal visible={showCategoryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>분류 선택</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color="#2c3e50" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={CATEGORIES}
              keyExtractor={(item) => item.value}
              style={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.categoryItem, category === item.value && styles.categoryItemSelected]}
                  onPress={() => { setCategory(item.value); setShowCategoryModal(false); }}
                >
                  <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                  <Text style={styles.categoryLabel}>{item.label}</Text>
                  {category === item.value && (
                    <Ionicons name="checkmark" size={22} color="#4A90E2" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* 提醒选择弹窗 */}
      <Modal visible={showReminderModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.reminderModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>알림 설정</Text>
              <TouchableOpacity onPress={() => setShowReminderModal(false)}>
                <Ionicons name="close" size={24} color="#2c3e50" />
              </TouchableOpacity>
            </View>

            <View style={styles.reminderToggle}>
              <Text style={styles.optionLabel}>알림 켜기</Text>
              <Switch value={reminderEnabled} onValueChange={setReminderEnabled} trackColor={{ true: "#4A90E2" }} />
            </View>

            <FlatList
              data={reminderEnabled ? REMINDER_OPTIONS : []}
              keyExtractor={(item) => item.value.toString()}
              style={{ flex: 1 }}
              ListEmptyComponent={
                <Text style={styles.reminderOffText}>알림이 꺼져 있습니다.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.categoryItem, reminderMinutes === item.value && styles.categoryItemSelected]}
                  onPress={() => { setReminderMinutes(item.value); setShowReminderModal(false); }}
                >
                  <Text style={styles.categoryLabel}>{item.label}</Text>
                  {reminderMinutes === item.value && (
                    <Ionicons name="checkmark" size={22} color="#4A90E2" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* 参与人选择弹窗 */}
      <Modal visible={showAttendeeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.attendeeModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>참여자 선택</Text>
              <TouchableOpacity onPress={() => setShowAttendeeModal(false)}>
                <Ionicons name="close" size={24} color="#2c3e50" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={teamMembers}
              keyExtractor={(item) => item._id}
              style={{ flex: 1 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.categoryItem, attendees.includes(item._id) && styles.categoryItemSelected]}
                  onPress={() => toggleAttendee(item._id)}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.categoryLabel}>{item.name}</Text>
                    <Text style={styles.memberRole}>{item.role === "owner" ? "팀장" : item.role === "admin" ? "관리자" : "멤버"}</Text>
                  </View>
                  {attendees.includes(item._id) && (
                    <Ionicons name="checkmark-circle" size={24} color="#4A90E2" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
      <FreeBusyModal
        visible={showFreeBusy}
        onClose={() => setShowFreeBusy(false)}
        teamId={teamId}
        date={startDate}
        selectedUserIds={attendees}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6fa" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  headerBtn: { width: 60, alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "600", color: "#2c3e50" },
  saveText: { color: "#4A90E2", fontSize: 16, fontWeight: "600" },
  body: { flex: 1, padding: 20 },
  titleInput: {
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 17, color: "#2c3e50", marginBottom: 12,
    borderWidth: 1, borderColor: "#e0e0e0",
  },
  descInput: {
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: "#2c3e50", marginBottom: 20, minHeight: 80,
    borderWidth: 1, borderColor: "#e0e0e0", textAlignVertical: "top",
  },
  optionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 12, borderWidth: 1, borderColor: "#e0e0e0",
  },
  optionLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  optionRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  optionLabel: { fontSize: 15, color: "#2c3e50" },
  optionValue: { fontSize: 15, color: "#7f8c8d" },
  categoryDot: { width: 12, height: 12, borderRadius: 6 },
  inputRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 12, borderWidth: 1, borderColor: "#e0e0e0", gap: 10,
  },
  locationInput: {
    flex: 1, fontSize: 15, color: "#2c3e50",
  },
  section: { marginBottom: 12 },
  sectionLabel: { fontSize: 13, color: "#7f8c8d", marginBottom: 6, marginLeft: 4 },
  dateInput: {
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: "#2c3e50", borderWidth: 1, borderColor: "#e0e0e0",
  },
  dateInputFull: { width: "100%", marginBottom: 8 },
  dateInputActive: { borderColor: "#4A90E2" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeInputField: { flex: 1 },
  ampmBtn: {
    paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12,
    backgroundColor: "#f5f6fa", borderWidth: 1, borderColor: "#e0e0e0",
    alignItems: "center",
  },
  ampmBtnActive: { backgroundColor: "#4A90E2", borderColor: "#4A90E2" },
  ampmBtnText: { fontSize: 14, color: "#7f8c8d", fontWeight: "600" },
  ampmBtnTextActive: { color: "#fff" },
  calendarCard: {
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e0e0e0",
    overflow: "hidden", marginBottom: 20,
  },
  calendarTabs: {
    flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  calendarTab: {
    flex: 1, paddingVertical: 11, alignItems: "center",
  },
  calendarTabActive: {
    borderBottomWidth: 2, borderBottomColor: "#4A90E2",
  },
  calendarTabText: { fontSize: 14, color: "#aaa" },
  calendarTabTextActive: { color: "#4A90E2", fontWeight: "600" },
  // Modal styles
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalList: { flexGrow: 0 },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  modalTitle: { fontSize: 17, fontWeight: "600", color: "#2c3e50" },
  categoryItem: {
    flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
    gap: 12,
  },
  categoryItemSelected: { backgroundColor: "#f0f7ff" },
  categoryLabel: { fontSize: 15, color: "#2c3e50", flex: 1 },
  reminderModalContent: { height: "70%" },
  attendeeModalContent: { height: "50%" },
  reminderOffText: {
    textAlign: "center", marginTop: 40, fontSize: 14, color: "#aaa",
  },
  reminderToggle: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#4A90E2",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  memberInfo: { flex: 1 },
  memberRole: { fontSize: 12, color: "#7f8c8d", marginTop: 2 },
});
