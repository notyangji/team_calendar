import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, ScrollView, Modal,
} from "react-native";
import KakaoShareLink from "react-native-kakao-share-link";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

LocaleConfig.locales["ko"] = {
  monthNames: ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"],
  monthNamesShort: ["1","2","3","4","5","6","7","8","9","10","11","12"],
  dayNames: ["일요일","월요일","화요일","수요일","목요일","금요일","토요일"],
  dayNamesShort: ["일","월","화","수","목","금","토"],
};
LocaleConfig.defaultLocale = "ko";

const today = new Date().toISOString().split("T")[0];

const CATEGORY_COLORS = {
  work: "#4A90E2", meeting: "#9B59B6", outdoor: "#27AE60",
  vacation: "#F39C12", deadline: "#E74C3C", personal: "#1ABC9C",
};

const ROLES = [
  { value: "admin", label: "관리자", color: "#9B59B6", description: "일정 관리, 멤버 초대 가능" },
  { value: "member", label: "멤버", color: "#4A90E2", description: "일정 생성 및 조회 가능" },
  { value: "guest", label: "게스트", color: "#7f8c8d", description: "일정 조회만 가능" },
];

const formatTimeKr = (isoDate) => {
  const t = isoDate?.split("T")[1]?.slice(0, 5);
  if (!t) return "시간 미설정";
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${ampm} ${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const parseTeamData = (data, myId) => {
  const ownerId = data.owner?._id || data.owner;
  const list = (data.members || []).map(m => {
    const id = m._id || m;
    const idStr = String(id);
    let role = "member";
    if (String(ownerId) === idStr) role = "owner";
    else if (data.memberRoles?.[idStr]) role = data.memberRoles[idStr];
    return { _id: id, name: m.name || "알 수 없음", email: m.email || "", role };
  });
  const myRole = String(ownerId) === String(myId)
    ? "owner"
    : (data.memberRoles?.[String(myId)] || "member");
  return {
    grouped: {
      owner: list.filter(m => m.role === "owner"),
      admins: list.filter(m => m.role === "admin"),
      members: list.filter(m => m.role === "member"),
      guests: list.filter(m => m.role === "guest"),
    },
    myRole,
  };
};

export default function TeamDetailScreen({ navigation, route }) {
  const { teamId } = route.params;
  const { user } = useAuth();

  const [team, setTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("calendar");
  const [selectedDate, setSelectedDate] = useState(today);
  const [markedDates, setMarkedDates] = useState({ [today]: { selected: true, selectedColor: "#4A90E2" } });

  const [menuVisible, setMenuVisible] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [roleModal, setRoleModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  const buildMarks = useCallback((list, selDate) => {
    const marks = {};
    list.forEach(ev => {
      const start = ev?.startDate?.split?.("T")?.[0];
      const end = ev?.endDate?.split?.("T")?.[0] || start;
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
    });
    const selColor = marks[selDate]?.color || "#4A90E2";
    marks[selDate] = {
      ...(marks[selDate] || {}),
      color: selColor,
      startingDay: marks[selDate]?.startingDay ?? true,
      endingDay: marks[selDate]?.endingDay ?? true,
      selected: true,
      selectedColor: selColor,
    };
    setMarkedDates(marks);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, eventsRes] = await Promise.all([
        client.get(`/teams/${teamId}`),
        client.get(`/events?teamId=${teamId}`).catch(() => ({ data: [] })),
      ]);
      const data = teamRes.data;
      const myId = user?._id || user?.id;
      const { grouped, myRole: role } = parseTeamData(data, myId);
      setTeam(data);
      setTeamMembers(grouped);
      setMyRole(role);
      const list = Array.isArray(eventsRes.data) ? eventsRes.data : [];
      setEvents(list);
      buildMarks(list, selectedDate);
    } catch (e) {
      Alert.alert("오류", "팀 정보를 불러오지 못했습니다.");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [teamId, user, selectedDate, buildMarks]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
    buildMarks(events, day.dateString);
  };

  const dayEvents = events.filter(e => {
    try {
      const start = e?.startDate?.split?.("T")?.[0];
      const end = e?.endDate?.split?.("T")?.[0] || start;
      return start && selectedDate >= start && selectedDate <= end;
    } catch { return false; }
  });

  const handleGetInvite = async () => {
    setMenuVisible(false);
    try {
      const { data } = await client.get(`/teams/${teamId}/invite`);
      setInviteCode(data.inviteCode);
      setInviteVisible(true);
    } catch (e) {
      Alert.alert("오류", "초대 코드를 불러오지 못했습니다.");
    }
  };

  const handleRegenerateInvite = async () => {
    try {
      const { data } = await client.put(`/teams/${teamId}/regenerate-invite`);
      setInviteCode(data.inviteCode);
    } catch (e) {
      Alert.alert("오류", "재생성에 실패했습니다.");
    }
  };

  const handleKakaoShare = async () => {
    try {
      await KakaoShareLink.sendFeed({
        content: {
          title: `${team?.name} 팀 초대`,
          imageUrl: "https://developers.kakao.com/assets/img/about/logos/kakaolink/kakaolink_btn_medium.png",
          link: {
            mobileWebUrl: "https://developers.kakao.com",
            androidExecutionParams: [{ key: "inviteCode", value: inviteCode }],
          },
          desc: `초대 코드: ${inviteCode}`,
        },
        buttons: [
          {
            title: "팀 참가하기",
            link: {
              mobileWebUrl: "https://developers.kakao.com",
              androidExecutionParams: [{ key: "inviteCode", value: inviteCode }],
            },
          },
        ],
      });
    } catch (e) {
      Alert.alert("오류", String(e?.message || e));
    }
  };

  const handleLeaveTeam = () => {
    setMenuVisible(false);
    Alert.alert("팀 나가기", "정말 이 팀을 나가시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "나가기", style: "destructive", onPress: async () => {
          try {
            await client.post(`/teams/${teamId}/leave`);
            navigation.goBack();
          } catch (e) {
            Alert.alert("오류", e.response?.data?.message || "실패했습니다.");
          }
        },
      },
    ]);
  };

  const handleDeleteTeam = () => {
    setMenuVisible(false);
    Alert.alert("팀 삭제", "정말 이 팀을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive", onPress: async () => {
          try {
            await client.delete(`/teams/${teamId}`);
            navigation.goBack();
          } catch (e) {
            Alert.alert("오류", e.response?.data?.message || "실패했습니다.");
          }
        },
      },
    ]);
  };

  const handleUpdateRole = async (newRole) => {
    if (!selectedMember) return;
    try {
      await client.post("/teams/member-role", { teamId, userId: String(selectedMember._id), role: newRole });
      setRoleModal(false);
      setSelectedMember(null);
      fetchAll();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "역할 변경에 실패했습니다.";
      console.error("역할 변경 실패:", e?.response?.status, msg);
      Alert.alert("오류", msg);
    }
  };

  const handleDeleteEvent = (event) => {
    Alert.alert("일정 삭제", `"${event.title}" 일정을 삭제하시겠습니까?`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive", onPress: async () => {
          try {
            await client.delete(`/events/${event._id}`);
            fetchAll();
          } catch (e) {
            Alert.alert("오류", e?.response?.data?.message || "삭제에 실패했습니다.");
          }
        },
      },
    ]);
  };

  const handleRemoveMember = (member) => {
    Alert.alert("멤버 강퇴", `${member.name}님을 강퇴하시겠습니까?`, [
      { text: "취소", style: "cancel" },
      {
        text: "강퇴", style: "destructive", onPress: async () => {
          try {
            await client.delete(`/teams/${teamId}/members/${member._id}`);
            fetchAll();
          } catch (e) {
            Alert.alert("오류", e.response?.data?.message || "강퇴에 실패했습니다.");
          }
        },
      },
    ]);
  };

  const getRoleBadge = (role) => {
    const rc = ROLES.find(r => r.value === role);
    const color = rc?.color || "#4A90E2";
    const label = role === "owner" ? "팀장" : rc?.label || role;
    return (
      <View style={[styles.roleBadge, { backgroundColor: `${color}20` }]}>
        <Text style={[styles.roleBadgeText, { color }]}>{label}</Text>
      </View>
    );
  };

  const renderMemberSection = (title, members, showActions = false) => {
    if (!members?.length) return null;
    return (
      <View style={styles.memberSection} key={title}>
        <Text style={styles.memberSectionTitle}>{title} ({members.length}명)</Text>
        {members.map(m => (
          <View key={String(m._id)} style={styles.memberRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{m.name[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{m.name}</Text>
              <Text style={styles.memberEmail}>{m.email}</Text>
            </View>
            {getRoleBadge(m.role)}
            {showActions && myRole === "owner" && (
              <View style={styles.actionBtns}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => { setSelectedMember(m); setRoleModal(true); }}>
                  <Ionicons name="person-outline" size={15} color="#4A90E2" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleRemoveMember(m)}>
                  <Ionicons name="close-outline" size={15} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };

  if (loading && !team) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  const myRoleLabel = myRole === "owner" ? "팀장" : myRole === "admin" ? "관리자" : myRole === "member" ? "멤버" : "게스트";

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#2c3e50" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{team?.name || "팀"}</Text>
          {myRole && <Text style={styles.headerRole}>{myRoleLabel}</Text>}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={fetchAll} style={styles.headerBtn}>
            <Ionicons name="refresh-outline" size={20} color="#4A90E2" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerBtn}>
            <Ionicons name="ellipsis-horizontal" size={22} color="#2c3e50" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "calendar" && styles.tabActive]}
          onPress={() => setActiveTab("calendar")}
        >
          <Ionicons name={activeTab === "calendar" ? "calendar" : "calendar-outline"} size={16} color={activeTab === "calendar" ? "#4A90E2" : "#aaa"} />
          <Text style={[styles.tabText, activeTab === "calendar" && styles.tabTextActive]}>캘린더</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "members" && styles.tabActive]}
          onPress={() => setActiveTab("members")}
        >
          <Ionicons name={activeTab === "members" ? "people" : "people-outline"} size={16} color={activeTab === "members" ? "#4A90E2" : "#aaa"} />
          <Text style={[styles.tabText, activeTab === "members" && styles.tabTextActive]}>멤버 {teamMembers ? `(${(teamMembers.owner?.length || 0) + (teamMembers.admins?.length || 0) + (teamMembers.members?.length || 0) + (teamMembers.guests?.length || 0)}명)` : ""}</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Tab */}
      {activeTab === "calendar" && (
        <View style={{ flex: 1 }}>
          <Calendar
            current={today}
            onDayPress={handleDayPress}
            markingType="period"
            markedDates={markedDates}
            theme={{
              todayTextColor: "#4A90E2",
              arrowColor: "#4A90E2",
              selectedDayBackgroundColor: "#4A90E2",
              selectedDayTextColor: "#fff",
              dotColor: "#4A90E2",
              textDayFontSize: 14,
              textMonthFontSize: 16,
              textMonthFontWeight: "bold",
            }}
          />
          <View style={styles.eventSection}>
            <Text style={styles.dateLabel}>{selectedDate.replace(/-/g, ".")} 일정</Text>
            {loading ? (
              <ActivityIndicator color="#4A90E2" style={{ marginTop: 20 }} />
            ) : dayEvents.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="calendar-outline" size={36} color="#ccc" />
                <Text style={styles.emptyText}>일정이 없습니다</Text>
              </View>
            ) : (
              <FlatList
                data={dayEvents}
                keyExtractor={item => item._id}
                renderItem={({ item }) => {
                  const creatorId = item.createdBy?._id || item.createdBy;
                  const myId = user?._id || user?.id;
                  const canEdit = myRole === "owner" || myRole === "admin" || String(creatorId) === String(myId);
                  return (
                    <TouchableOpacity
                      style={styles.eventCard}
                      onPress={() => canEdit && navigation.navigate("AddEvent", { event: item, teamId })}
                      activeOpacity={canEdit ? 0.7 : 1}
                    >
                      <View style={styles.eventDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventTitle}>{item.title}</Text>
                        {item.description ? <Text style={styles.eventDesc}>{item.description}</Text> : null}
                        <Text style={styles.eventTime}>
                          {item.allDay ? "하루 종일" : formatTimeKr(item.startDate)}
                        </Text>
                      </View>
                      {canEdit && (
                        <View style={styles.eventActions}>
                          <TouchableOpacity
                            style={styles.eventActionBtn}
                            onPress={() => navigation.navigate("AddEvent", { event: item, teamId })}
                          >
                            <Ionicons name="pencil-outline" size={15} color="#4A90E2" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.eventActionBtn}
                            onPress={() => handleDeleteEvent(item)}
                          >
                            <Ionicons name="trash-outline" size={15} color="#e74c3c" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate("AddEvent", { selectedDate, teamId })}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Members Tab */}
      {activeTab === "members" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {teamMembers ? (
            <>
              {renderMemberSection("팀장", teamMembers.owner)}
              {renderMemberSection("관리자", teamMembers.admins, true)}
              {renderMemberSection("멤버", teamMembers.members, true)}
              {renderMemberSection("게스트", teamMembers.guests, true)}
            </>
          ) : (
            <ActivityIndicator color="#4A90E2" />
          )}
        </ScrollView>
      )}

      {/* 메뉴 모달 */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuBox} onStartShouldSetResponder={() => true}>
            <TouchableOpacity style={styles.menuItem} onPress={handleGetInvite}>
              <Ionicons name="link-outline" size={18} color="#4A90E2" />
              <Text style={styles.menuItemText}>초대 코드</Text>
            </TouchableOpacity>
            {myRole !== "owner" && (
              <TouchableOpacity style={styles.menuItem} onPress={handleLeaveTeam}>
                <Ionicons name="exit-outline" size={18} color="#f39c12" />
                <Text style={[styles.menuItemText, { color: "#f39c12" }]}>팀 나가기</Text>
              </TouchableOpacity>
            )}
            {myRole === "owner" && (
              <TouchableOpacity style={styles.menuItem} onPress={handleDeleteTeam}>
                <Ionicons name="trash-outline" size={18} color="#e74c3c" />
                <Text style={[styles.menuItemText, { color: "#e74c3c" }]}>팀 삭제</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 초대 코드 모달 */}
      <Modal visible={inviteVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setInviteVisible(false)}>
          <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>초대 코드</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{inviteCode}</Text>
            </View>
            <TouchableOpacity style={styles.regenBtn} onPress={handleRegenerateInvite}>
              <Ionicons name="refresh-outline" size={15} color="#7f8c8d" />
              <Text style={styles.regenBtnText}>코드 재생성</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.kakaoBtn} onPress={handleKakaoShare}>
              <Text style={styles.kakaoBtnText}>💬  카카오톡으로 초대</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => setInviteVisible(false)}>
              <Text style={styles.confirmBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 역할 변경 모달 */}
      <Modal visible={roleModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setRoleModal(false)}>
          <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>역할 변경</Text>
            <Text style={styles.roleMemberName}>{selectedMember?.name}님의 역할을 변경합니다</Text>
            {ROLES.map(role => (
              <TouchableOpacity
                key={role.value}
                style={[styles.roleOption, selectedMember?.role === role.value && styles.roleOptionActive]}
                onPress={() => handleUpdateRole(role.value)}
              >
                <View style={[styles.roleDot, { backgroundColor: role.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleLabel}>{role.label}</Text>
                  <Text style={styles.roleDesc}>{role.description}</Text>
                </View>
                {selectedMember?.role === role.value && <Ionicons name="checkmark" size={20} color="#4A90E2" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setRoleModal(false)}>
              <Text style={styles.cancelBtnText}>취소</Text>
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
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  headerBtn: { width: 36, alignItems: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "bold", color: "#2c3e50" },
  headerRole: { fontSize: 11, color: "#4A90E2", marginTop: 1 },
  tabBar: {
    flexDirection: "row", backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 12, gap: 6,
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#4A90E2" },
  tabText: { fontSize: 14, color: "#aaa" },
  tabTextActive: { color: "#4A90E2", fontWeight: "600" },
  eventSection: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  dateLabel: { fontSize: 14, fontWeight: "600", color: "#2c3e50", marginBottom: 10 },
  emptyBox: { alignItems: "center", marginTop: 30 },
  emptyText: { color: "#aaa", marginTop: 8, fontSize: 14 },
  eventCard: {
    flexDirection: "row", alignItems: "flex-start", backgroundColor: "#fff",
    borderRadius: 10, padding: 12, marginBottom: 8,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  eventDot: {
    width: 9, height: 9, borderRadius: 5, backgroundColor: "#4A90E2",
    marginTop: 4, marginRight: 10,
  },
  eventTitle: { fontSize: 14, fontWeight: "600", color: "#2c3e50" },
  eventDesc: { fontSize: 12, color: "#7f8c8d", marginTop: 2 },
  eventTime: { fontSize: 11, color: "#aaa", marginTop: 3 },
  eventActions: { flexDirection: "row", gap: 4, marginLeft: 8 },
  eventActionBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: "#f5f6fa",
    justifyContent: "center", alignItems: "center",
  },
  fab: {
    position: "absolute", bottom: 20, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#4A90E2", justifyContent: "center", alignItems: "center",
    shadowColor: "#4A90E2", shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  memberSection: { marginBottom: 20 },
  memberSectionTitle: {
    fontSize: 11, color: "#7f8c8d", fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8,
  },
  memberRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 10, padding: 12, marginBottom: 6,
    shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#e8f0fb",
    justifyContent: "center", alignItems: "center", marginRight: 10,
  },
  avatarText: { color: "#4A90E2", fontWeight: "bold", fontSize: 14 },
  memberName: { fontSize: 14, fontWeight: "600", color: "#2c3e50" },
  memberEmail: { fontSize: 12, color: "#aaa", marginTop: 1 },
  roleBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 6 },
  roleBadgeText: { fontSize: 11, fontWeight: "600" },
  actionBtns: { flexDirection: "row", gap: 4, marginLeft: 6 },
  actionBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: "#f5f6fa",
    justifyContent: "center", alignItems: "center",
  },
  menuOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start", alignItems: "flex-end",
    paddingTop: 60, paddingRight: 16,
  },
  menuBox: {
    backgroundColor: "#fff", borderRadius: 12, paddingVertical: 4,
    minWidth: 160,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  menuItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: "#f5f6fa",
  },
  menuItemText: { fontSize: 14, color: "#2c3e50", fontWeight: "500" },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalBox: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20, width: "100%",
  },
  modalTitle: { fontSize: 17, fontWeight: "bold", color: "#2c3e50", marginBottom: 16 },
  codeBox: {
    backgroundColor: "#f5f6fa", borderRadius: 10, padding: 16,
    alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "#e0e0e0",
  },
  codeText: { fontSize: 24, fontWeight: "bold", color: "#2c3e50", letterSpacing: 4 },
  regenBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, marginBottom: 12,
  },
  regenBtnText: { color: "#7f8c8d", fontSize: 13 },
  kakaoBtn: {
    paddingVertical: 12, borderRadius: 10, alignItems: "center",
    backgroundColor: "#FEE500", marginBottom: 8,
  },
  kakaoBtnText: { color: "#3C1E1E", fontSize: 15, fontWeight: "600" },
  confirmBtn: {
    paddingVertical: 12, borderRadius: 10, alignItems: "center", backgroundColor: "#4A90E2",
  },
  confirmBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  cancelBtn: {
    paddingVertical: 12, borderRadius: 10, alignItems: "center",
    backgroundColor: "#f5f6fa", borderWidth: 1, borderColor: "#e0e0e0", marginTop: 8,
  },
  cancelBtnText: { color: "#7f8c8d", fontSize: 15, fontWeight: "600" },
  roleMemberName: { fontSize: 13, color: "#7f8c8d", marginBottom: 12 },
  roleOption: {
    flexDirection: "row", alignItems: "center", padding: 12, marginBottom: 8,
    backgroundColor: "#f5f6fa", borderRadius: 10, gap: 12,
    borderWidth: 1, borderColor: "#e0e0e0",
  },
  roleOptionActive: { borderColor: "#4A90E2", backgroundColor: "#f0f7ff" },
  roleDot: { width: 10, height: 10, borderRadius: 5 },
  roleLabel: { fontSize: 14, fontWeight: "600", color: "#2c3e50" },
  roleDesc: { fontSize: 11, color: "#7f8c8d", marginTop: 1 },
});
