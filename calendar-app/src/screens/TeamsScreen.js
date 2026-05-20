import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Alert, ActivityIndicator, Modal, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function TeamsScreen() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  // 모달 상태
  const [createModal, setCreateModal] = useState(false);
  const [joinModal, setJoinModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);

  // 입력값
  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/teams");
      setTeams(data);
    } catch (e) {
      Alert.alert("오류", e.response?.data?.message || "팀 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, []);

  // 팀 생성
  const handleCreateTeam = async () => {
    if (!teamName.trim()) return Alert.alert("알림", "팀 이름을 입력해주세요.");
    try {
      await client.post("/teams", { name: teamName.trim(), description: teamDesc.trim() });
      setCreateModal(false);
      setTeamName("");
      setTeamDesc("");
      fetchTeams();
    } catch (e) {
      Alert.alert("오류", e.response?.data?.message || "팀 생성에 실패했습니다.");
    }
  };

  // 초대 코드로 참가
  const handleJoinTeam = async () => {
    if (!inviteCode.trim()) return Alert.alert("알림", "초대 코드를 입력해주세요.");
    try {
      await client.post("/teams/join", { inviteCode: inviteCode.trim() });
      setJoinModal(false);
      setInviteCode("");
      fetchTeams();
      Alert.alert("성공", "팀에 참가했습니다!");
    } catch (e) {
      Alert.alert("오류", e.response?.data?.message || "팀 참가에 실패했습니다.");
    }
  };

  // 팀 상세 보기
  const handleOpenDetail = async (team) => {
    try {
      const { data } = await client.get(`/teams/${team._id}`);
      setSelectedTeam(data);
      setDetailModal(true);
    } catch (e) {
      Alert.alert("오류", "팀 정보를 불러오지 못했습니다.");
    }
  };

  // 초대 링크 보기
  const handleGetInviteLink = async (teamId) => {
    try {
      const { data } = await client.get(`/teams/${teamId}/invite`);
      setInviteCode(data.inviteCode);
      setInviteModal(true);
    } catch (e) {
      Alert.alert("오류", e.response?.data?.message || "초대 링크를 불러오지 못했습니다.");
    }
  };

  // 초대 코드 재생성
  const handleRegenerateInvite = async (teamId) => {
    try {
      const { data } = await client.post(`/teams/${teamId}/invite/regenerate`);
      setInviteCode(data.inviteCode);
      Alert.alert("완료", "초대 코드가 재생성되었습니다.");
    } catch (e) {
      Alert.alert("오류", e.response?.data?.message || "재생성에 실패했습니다.");
    }
  };

  // 팀 나가기
  const handleLeaveTeam = (teamId) => {
    Alert.alert("팀 나가기", "정말 이 팀을 나가시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "나가기", style: "destructive", onPress: async () => {
          try {
            await client.post(`/teams/${teamId}/leave`);
            setDetailModal(false);
            fetchTeams();
          } catch (e) {
            Alert.alert("오류", e.response?.data?.message || "팀 나가기에 실패했습니다.");
          }
        }
      }
    ]);
  };

  // 팀 삭제
  const handleDeleteTeam = (teamId) => {
    Alert.alert("팀 삭제", "정말 이 팀을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive", onPress: async () => {
          try {
            await client.delete(`/teams/${teamId}`);
            setDetailModal(false);
            fetchTeams();
          } catch (e) {
            Alert.alert("오류", e.response?.data?.message || "팀 삭제에 실패했습니다.");
          }
        }
      }
    ]);
  };

  // 멤버 강퇴 (팀장만)
  const handleRemoveMember = (teamId, memberId, memberName) => {
    Alert.alert("멤버 강퇴", `${memberName}님을 강퇴하시겠습니까?`, [
      { text: "취소", style: "cancel" },
      {
        text: "강퇴", style: "destructive", onPress: async () => {
          try {
            await client.delete(`/teams/${teamId}/members/${memberId}`);
            const { data } = await client.get(`/teams/${teamId}`);
            setSelectedTeam(data);
          } catch (e) {
            Alert.alert("오류", e.response?.data?.message || "강퇴에 실패했습니다.");
          }
        }
      }
    ]);
  };

  const renderTeamItem = ({ item }) => (
    <TouchableOpacity style={styles.teamCard} onPress={() => handleOpenDetail(item)}>
      <View style={styles.teamIconBox}>
        <Text style={styles.teamIconText}>{item.name[0]?.toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.teamName}>{item.name}</Text>
        {item.description ? <Text style={styles.teamDesc}>{item.description}</Text> : null}
        <Text style={styles.teamOwner}>팀장: {item.owner?.name}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>팀 관리</Text>
        <TouchableOpacity onPress={fetchTeams}>
          <Ionicons name="refresh-outline" size={22} color="#4A90E2" />
        </TouchableOpacity>
      </View>

      {/* 팀 목록 */}
      {loading ? (
        <ActivityIndicator color="#4A90E2" style={{ marginTop: 40 }} />
      ) : teams.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>아직 팀이 없습니다</Text>
          <Text style={styles.emptySubText}>팀을 만들거나 초대 코드로 참가해보세요</Text>
        </View>
      ) : (
        <FlatList
          data={teams}
          keyExtractor={(item) => item._id}
          renderItem={renderTeamItem}
          contentContainerStyle={{ padding: 16 }}
        />
      )}

      {/* 하단 버튼 */}
      <View style={styles.bottomBtns}>
        <TouchableOpacity style={styles.joinBtn} onPress={() => setJoinModal(true)}>
          <Ionicons name="enter-outline" size={18} color="#4A90E2" />
          <Text style={styles.joinBtnText}>코드로 참가</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.createBtn} onPress={() => setCreateModal(true)}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createBtnText}>팀 만들기</Text>
        </TouchableOpacity>
      </View>

      {/* 팀 생성 모달 */}
      <Modal visible={createModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>새 팀 만들기</Text>
            <TextInput
              style={styles.input}
              placeholder="팀 이름"
              placeholderTextColor="#aaa"
              value={teamName}
              onChangeText={setTeamName}
            />
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              placeholder="팀 설명 (선택)"
              placeholderTextColor="#aaa"
              value={teamDesc}
              onChangeText={setTeamDesc}
              multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModal(false)}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleCreateTeam}>
                <Text style={styles.confirmBtnText}>만들기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 코드로 참가 모달 */}
      <Modal visible={joinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>초대 코드로 참가</Text>
            <TextInput
              style={styles.input}
              placeholder="초대 코드 입력"
              placeholderTextColor="#aaa"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="none"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setJoinModal(false); setInviteCode(""); }}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleJoinTeam}>
                <Text style={styles.confirmBtnText}>참가</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 팀 상세 모달 */}
      <Modal visible={detailModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: "80%" }]}>
            <Text style={styles.modalTitle}>{selectedTeam?.name}</Text>
            {selectedTeam?.description ? (
              <Text style={styles.teamDescModal}>{selectedTeam.description}</Text>
            ) : null}

            <Text style={styles.memberLabel}>멤버 ({selectedTeam?.members?.length}명)</Text>
            <ScrollView style={{ maxHeight: 160 }}>
              {selectedTeam?.members?.map((m) => (
                <View key={m._id} style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>{m.name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{m.name}</Text>
                    <Text style={styles.memberEmail}>{m.email}</Text>
                  </View>
                  {selectedTeam?.owner?._id === m._id ? (
                    <View style={styles.ownerBadge}>
                      <Text style={styles.ownerBadgeText}>팀장</Text>
                    </View>
                  ) : selectedTeam?.owner?._id === user?._id ? (
                    <TouchableOpacity
                      style={styles.kickBtn}
                      onPress={() => handleRemoveMember(selectedTeam._id, m._id, m.name)}
                    >
                      <Text style={styles.kickBtnText}>강퇴</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </ScrollView>

            {/* 초대 버튼 */}
            <TouchableOpacity
              style={styles.inviteBtn}
              onPress={() => handleGetInviteLink(selectedTeam?._id)}
            >
              <Ionicons name="link-outline" size={16} color="#4A90E2" />
              <Text style={styles.inviteBtnText}>초대 코드 보기</Text>
            </TouchableOpacity>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDetailModal(false)}>
                <Text style={styles.cancelBtnText}>닫기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.leaveBtn}
                onPress={() => handleLeaveTeam(selectedTeam?._id)}
              >
                <Text style={styles.leaveBtnText}>나가기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteTeam(selectedTeam?._id)}
              >
                <Text style={styles.deleteBtnText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 초대 코드 모달 */}
      <Modal visible={inviteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>초대 코드</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{inviteCode}</Text>
            </View>
            <TouchableOpacity
              style={styles.regenBtn}
              onPress={() => handleRegenerateInvite(selectedTeam?._id)}
            >
              <Ionicons name="refresh-outline" size={16} color="#7f8c8d" />
              <Text style={styles.regenBtnText}>코드 재생성</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => setInviteModal(false)}>
              <Text style={styles.confirmBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#2c3e50" },
  emptyBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#aaa", marginTop: 12, fontSize: 15 },
  emptySubText: { color: "#ccc", marginTop: 6, fontSize: 13 },
  teamCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  teamIconBox: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#4A90E2",
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  teamIconText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  teamName: { fontSize: 15, fontWeight: "600", color: "#2c3e50" },
  teamDesc: { fontSize: 13, color: "#7f8c8d", marginTop: 2 },
  teamOwner: { fontSize: 12, color: "#aaa", marginTop: 2 },
  bottomBtns: {
    flexDirection: "row", padding: 16, gap: 10,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#eee",
  },
  joinBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 12, paddingVertical: 13, borderWidth: 1.5, borderColor: "#4A90E2",
    gap: 6,
  },
  joinBtnText: { color: "#4A90E2", fontSize: 15, fontWeight: "600" },
  createBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 12, paddingVertical: 13, backgroundColor: "#4A90E2", gap: 6,
  },
  createBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center", alignItems: "center", padding: 20,
  },
  modalBox: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20, width: "100%",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#2c3e50", marginBottom: 16 },
  input: {
    backgroundColor: "#f5f6fa", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: "#2c3e50", marginBottom: 12, borderWidth: 1, borderColor: "#e0e0e0",
  },
  modalBtns: { flexDirection: "row", gap: 8, marginTop: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center",
    backgroundColor: "#f5f6fa", borderWidth: 1, borderColor: "#e0e0e0",
  },
  cancelBtnText: { color: "#7f8c8d", fontSize: 15, fontWeight: "600" },
  confirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center",
    backgroundColor: "#4A90E2",
  },
  confirmBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  leaveBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center",
    backgroundColor: "#f39c12",
  },
  leaveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  deleteBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center",
    backgroundColor: "#e74c3c",
  },
  deleteBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  memberLabel: { fontSize: 13, color: "#7f8c8d", marginBottom: 8, fontWeight: "600" },
  memberRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  memberAvatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: "#e8f0fb",
    justifyContent: "center", alignItems: "center", marginRight: 10,
  },
  memberAvatarText: { color: "#4A90E2", fontWeight: "bold", fontSize: 14 },
  memberName: { fontSize: 14, fontWeight: "600", color: "#2c3e50" },
  memberEmail: { fontSize: 12, color: "#aaa" },
  ownerBadge: {
    marginLeft: "auto", backgroundColor: "#e8f0fb", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  ownerBadgeText: { color: "#4A90E2", fontSize: 11, fontWeight: "600" },
  inviteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 10, marginTop: 12, gap: 6,
    borderWidth: 1, borderColor: "#4A90E2", borderRadius: 10,
  },
  inviteBtnText: { color: "#4A90E2", fontSize: 14, fontWeight: "600" },
  codeBox: {
    backgroundColor: "#f5f6fa", borderRadius: 10, padding: 16,
    alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "#e0e0e0",
  },
  codeText: { fontSize: 24, fontWeight: "bold", color: "#2c3e50", letterSpacing: 4 },
  teamDescModal: { fontSize: 14, color: "#7f8c8d", marginBottom: 14 },
  regenBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, marginBottom: 12,
  },
  regenBtnText: { color: "#7f8c8d", fontSize: 13 },
  kickBtn: {
    backgroundColor: "#e74c3c", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  kickBtnText: { color: "#fff", fontSize: 11, fontWeight: "600" },
});
