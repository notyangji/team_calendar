import React from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import HomeScreen from "./src/screens/HomeScreen";
import TeamsScreen from "./src/screens/TeamsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import AddEventScreen from "./src/screens/AddEventScreen";
import OAuthRegisterScreen from "./src/screens/OAuthRegisterScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
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
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="AddEvent" component={AddEventScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="OAuthRegister" component={OAuthRegisterScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
