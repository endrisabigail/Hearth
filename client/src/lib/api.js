import axios from "axios";
import { io } from "socket.io-client";
import { auth } from "./firebase.js";
import { isDemo, demoAdapter, createDemoSocket } from "./demo.js";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

let authReadyPromise = null;

function waitForAuth() {
  if (!auth) return Promise.resolve(null);
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      const off = auth.onAuthStateChanged((u) => {
        off();
        resolve(u);
      });
    });
  }
  return authReadyPromise;
}

export async function getToken(forceRefresh = false) {
  if (isDemo()) return "demo";
  if (auth) {
    const user = auth.currentUser || (await waitForAuth());
    if (user) {
      const token = await user.getIdToken(forceRefresh);
      localStorage.setItem("token", token);
      return token;
    }
  }
  return localStorage.getItem("token");
}

export const api = axios.create({ baseURL: `${API_URL}/api` });

api.interceptors.request.use(async (config) => {
  if (isDemo()) {
    config.adapter = demoAdapter;
    return config;
  }
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retried && auth?.currentUser) {
      original._retried = true;
      const token = await getToken(true);
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    }
    return Promise.reject(error);
  },
);

export function connectSocket(namespace) {
  if (isDemo()) return createDemoSocket(namespace);
  return io(`${API_URL}${namespace}`, {
    transports: ["websocket"],
    auth: (cb) => {
      getToken()
        .then((token) => cb({ token }))
        .catch(() => cb({}));
    },
  });
}

export const errMsg = (err, fallback = "Something went wrong.") =>
  err?.response?.data?.msg || (typeof err?.response?.data === "string" && err.response.data.length < 120 ? err.response.data : null) || fallback;
