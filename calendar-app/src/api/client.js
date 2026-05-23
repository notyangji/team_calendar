import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const BACKEND_URL = "https://drew-evict-duchess.ngrok-free.dev";
const API_URL = `${BACKEND_URL}/api`;

const client = axios.create({
  baseURL: API_URL,
  headers: { "ngrok-skip-browser-warning": "true" },
});

export const setAuthToken = (token) => {
  if (token) {
    client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete client.defaults.headers.common["Authorization"];
  }
};

// 토큰 만료 등 401 응답 시 세션 자동 초기화
// onSessionExpired는 AuthContext에서 주입
let onSessionExpired = null;
let isHandling401 = false;

export const setSessionExpiredHandler = (handler) => {
  onSessionExpired = handler;
};

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !isHandling401) {
      isHandling401 = true;
      try {
        await AsyncStorage.removeItem("token").catch(() => {});
        await AsyncStorage.removeItem("user").catch(() => {});
      } catch {}
      setAuthToken(null);
      onSessionExpired?.();
      setTimeout(() => { isHandling401 = false; }, 1000);
    }
    return Promise.reject(error);
  }
);

export default client;
