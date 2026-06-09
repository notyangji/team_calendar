import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import client, { setAuthToken, setSessionExpiredHandler } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const logout = async () => {
    try {
      await AsyncStorage.removeItem("token").catch(() => {});
      await AsyncStorage.removeItem("user").catch(() => {});
    } finally {
      setAuthToken(null);
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    // 401 발생 시 자동 로그아웃
    setSessionExpiredHandler(logout);

    const restore = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("token");
        if (!storedToken) return;
        setToken(storedToken);
        setAuthToken(storedToken);
        const storedUser = await AsyncStorage.getItem("user");
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          try {
            const { data } = await client.get("/auth/me");
            setUser(data);
            await AsyncStorage.setItem("user", JSON.stringify({ ...data, token: storedToken }));
          } catch {
            // 토큰 만료 / 네트워크 오류 등 — 저장된 토큰으로만 진행
          }
        }
      } catch {
        // JSON.parse 실패 등 복원 오류 시 세션 초기화
        await AsyncStorage.removeItem("token").catch(() => {});
        await AsyncStorage.removeItem("user").catch(() => {});
        setAuthToken(null);
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  const saveSession = async (data) => {
    await AsyncStorage.setItem("token", data.token);
    await AsyncStorage.setItem("user", JSON.stringify(data));
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data);
  };

  const login = async (email, password) => {
    const { data } = await client.post("/auth/login", { email, password });
    await saveSession(data);
  };

  const register = async (name, email, password) => {
    const { data } = await client.post("/auth/register", { name, email, password });
    await saveSession(data);
  };

  const loginWithOAuth = async (data) => {
    await saveSession(data);
  };

  const updateUser = async (partial) => {
    setUser(prev => {
      const next = { ...prev, ...partial };
      AsyncStorage.setItem("user", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, loginWithOAuth, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
