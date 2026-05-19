import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import client, { setAuthToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      const stored = await AsyncStorage.getItem("token");
      if (stored) {
        setToken(stored);
        setAuthToken(stored);
      }
      setLoading(false);
    };
    restore();
  }, []);

  const saveSession = async (data) => {
    await AsyncStorage.setItem("token", data.token);
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

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, loginWithOAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
