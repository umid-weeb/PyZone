import { authApi, clearToken, getToken, setToken } from "./api.js";

export async function requireAuth(redirectBack = "/arena.html") {
  const token = getToken();
  if (!token) {
    window.location.href = `/login.html?next=${encodeURIComponent(redirectBack)}`;
    return false;
  }
  try {
    await authApi.me();
    return true;
  } catch {
    clearToken();
    window.location.href = `/login.html?next=${encodeURIComponent(redirectBack)}`;
    return false;
  }
}

export async function login(username, password) {
  const data = await authApi.login({ username, password });
  if (data?.access_token) setToken(data.access_token);
  return data;
}

export async function register(payload) {
  const data = await authApi.register(payload);
  if (data?.access_token) setToken(data.access_token);
  return data;
}

export function logout() {
  clearToken();
  window.location.href = "/login.html";
}
