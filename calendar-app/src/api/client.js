import axios from "axios";
/*
import Constants from "expo-constants";

const host = Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";
const API_URL = `http://${host}:5000/api`;
export const BACKEND_URL = `http://${host}:5000`;
*/

const TUNNEL_URL = "https://drew-evict-duchess.ngrok-free.dev";
const API_URL = `${TUNNEL_URL}/api`;
export const BACKEND_URL = TUNNEL_URL;
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

export default client;
