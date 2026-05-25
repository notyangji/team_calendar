import React, { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, View, BackHandler, Alert, Modal, Text, TouchableOpacity, StyleSheet, ScrollView, ToastAndroid, Platform, Linking } from "react-native";
import client from "./src/api/client";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import changelog from "./src/changelog.json";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import HomeScreen from "./src/screens/HomeScreen_new";
import TeamsScreen from "./src/screens/TeamsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import AddEventScreen from "./src/screens/AddEventScreen";
import TeamDetailScreen from "./src/screens/TeamDetailScreen";
import OAuthRegisterScreen from "./src/screens/OAuthRegisterScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const lastBackPress = React.useRef(0);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        const now = Date.now();
        if (now - lastBackPress.current < 2000) {
          BackHandler.exitApp();
        } else {
          lastBackPress.current = now;
          if (Platform.OS === "android") {
            ToastAndroid.show("한 번 더 누르면 종료됩니다", ToastAndroid.SHORT);
          }
        }
        return true;
      });
      return () => sub.remove();
    }, [])
  );

  return (
    <Tab.Navigator
      backBehavior="none"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#4A90E2",
        tabBarInactiveTintColor: "#aaa",
        tabBarStyle: { borderTopColor: "#eee", paddingBottom: 4 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home: focused ? "calendar" : "calendar-outline",
            Teams: focused ? "people" : "people-outline",
            Profile: focused ? "person" : "person-outline",
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: "캘린더" }} />
      <Tab.Screen name="Teams" component={TeamsScreen} options={{ tabBarLabel: "팀" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: "프로필" }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={token ? "Main" : "Login"}
    >
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="AddEvent" component={AddEventScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="OAuthRegister" component={OAuthRegisterScreen} />
    </Stack.Navigator>
  );
}

async function checkForUpdate() {
  if (__DEV__) return;
  try {
    const update = await Updates.checkForUpdateAsync();
    if (!update.isAvailable) return;
    await Updates.fetchUpdateAsync();
    Alert.alert(
      "업데이트 완료",
      "새 버전이 설치되었습니다. 지금 재시작할까요?",
      [
        { text: "나중에" },
        { text: "재시작", onPress: async () => { try { await Updates.reloadAsync(); } catch {} } },
      ]
    );
  } catch {
    // 네트워크 오류 등 무시
  }
}

const handleInviteLink = async (url) => {
  if (!url) return;
  // teamcalendar://join/CODE 또는 카카오 androidExecutionParams ?inviteCode=CODE
  const directMatch = url.match(/teamcalendar:\/\/join\/([a-zA-Z0-9]+)/);
  const paramMatch = url.match(/[?&]inviteCode=([a-zA-Z0-9]+)/);
  const inviteCode = directMatch?.[1] || paramMatch?.[1];
  if (!inviteCode) return;

  Alert.alert("팀 초대", `초대 코드: ${inviteCode}\n팀에 참가하시겠습니까?`, [
    { text: "취소", style: "cancel" },
    {
      text: "참가", onPress: async () => {
        try {
          await client.post("/teams/join", { inviteCode });
          Alert.alert("성공", "팀에 참가했습니다!");
        } catch (e) {
          Alert.alert("오류", e?.response?.data?.message || "팀 참가에 실패했습니다.");
        }
      },
    },
  ]);
};

export default function App() {
  const [whatsNew, setWhatsNew] = useState(null);

  useEffect(() => {
    // 딥링크: 앱이 닫혀 있을 때 링크로 열린 경우
    Linking.getInitialURL().then(handleInviteLink);
    // 앱이 실행 중일 때 링크 수신
    const sub = Linking.addEventListener("url", ({ url }) => handleInviteLink(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    checkForUpdate();
    (async () => {
      const latest = changelog[0];
      if (!latest) return;
      const seen = await AsyncStorage.getItem("lastSeenVersion");
      if (seen !== latest.version) {
        setWhatsNew(latest);
        await AsyncStorage.setItem("lastSeenVersion", latest.version);
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
        {whatsNew !== null && (
          <Modal visible transparent animationType="fade">
            <TouchableOpacity style={modalStyles.overlay} activeOpacity={1} onPress={() => setWhatsNew(null)}>
              <View style={modalStyles.box} onStartShouldSetResponder={() => true}>
                <Text style={modalStyles.title}>새로운 기능</Text>
                <Text style={modalStyles.version}>v{whatsNew.version}  ·  {whatsNew.date}</Text>
                <ScrollView style={modalStyles.noteList}>
                  {whatsNew.notes.map((note, i) => (
                    <Text key={i} style={modalStyles.note}>• {note}</Text>
                  ))}
                </ScrollView>
                <TouchableOpacity style={modalStyles.btn} onPress={() => setWhatsNew(null)}>
                  <Text style={modalStyles.btnText}>확인</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center",
  },
  box: {
    width: "82%", backgroundColor: "#fff", borderRadius: 16,
    padding: 24, maxHeight: "70%",
  },
  title: { fontSize: 18, fontWeight: "bold", color: "#2c3e50", marginBottom: 4 },
  version: { fontSize: 13, color: "#7f8c8d", marginBottom: 16 },
  noteList: { marginBottom: 20 },
  note: { fontSize: 14, color: "#34495e", lineHeight: 22, marginBottom: 4 },
  btn: {
    backgroundColor: "#4A90E2", borderRadius: 10,
    paddingVertical: 12, alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
