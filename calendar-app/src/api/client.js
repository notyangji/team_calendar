import axios from "axios";
import Constants from "expo-constants";

// 개발 환경에서 Expo 서버 IP를 기반으로 백엔드 주소 자동 설정
const host = Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";
const API_URL = `http://${host}:5000/api`;
export const BACKEND_URL = `http://${host}:5000`;

const client = axios.create({ baseURL: API_URL });

export const setAuthToken = (token) => {
  if (token) {
    client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete client.defaults.headers.common["Authorization"];
  }
};

export default client;
