// Use local backend for development, remote for production
export const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" 
  ? "http://localhost:8000" 
  : "https://python-editor-b87c.onrender.com";
const TOKEN_KEY = "arena_jwt";
const USER_TOKEN_KEY = "userToken";

let problemsCache = null;
const problemDetailCache = new Map();

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getToken() {
  return (
    localStorage.getItem(USER_TOKEN_KEY) ||
    localStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem("access_token") ||
    ""
  );
}

export function setToken(token) {
  if (token) localStorage.setItem(USER_TOKEN_KEY, token);
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (token) localStorage.setItem("access_token", token);
}

export function clearToken() {
  localStorage.removeItem(USER_TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("access_token");
}

export async function fetchJson(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const resp = await fetch(url, {
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) },
    ...options,
  });
  if (!resp.ok) {
    const text = await resp.text();
    const err = new Error(text || `HTTP ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return resp.json();
  }
  return JSON.parse(await resp.text());
}

export async function getProblems(force = false) {
  if (problemsCache && !force) return problemsCache;
  problemsCache = await fetchJson("/api/problems");
  return problemsCache;
}

export async function getProblem(problemId) {
  if (problemDetailCache.has(problemId)) return problemDetailCache.get(problemId);
  const data = await fetchJson(`/api/problem/${encodeURIComponent(problemId)}`);
  problemDetailCache.set(problemId, data);
  return data;
}

export async function runSolution(problemId, code, language = "python") {
  return fetchJson("/api/run", {
    method: "POST",
    body: JSON.stringify({ problem_id: problemId, code, language }),
  });
}

export async function submitSolution(problemId, code, language = "python") {
  return fetchJson("/api/submit", {
    method: "POST",
    body: JSON.stringify({ problem_id: problemId, code, language }),
  });
}

// Auth APIs
export const authApi = {
  register: (payload) => fetchJson("/api/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => fetchJson("/api/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => fetchJson("/api/me"),
};

// User data APIs
export const userApi = {
  activity: () => fetchJson("/api/user/activity"),
  submissions: () => fetchJson("/api/user/submissions"),
  leaderboard: () => fetchJson("/api/leaderboard"),
  updateProfile: (payload) => fetchJson("/api/user/profile", { method: "PUT", body: JSON.stringify(payload) }),
  updatePassword: (payload) => fetchJson("/api/user/password", { method: "POST", body: JSON.stringify(payload) }),
  publicProfile: (username) => fetchJson(`/api/users/${encodeURIComponent(username)}`),
  searchUsers: async (query) => {
    // Use a plain GET without JSON headers to avoid unnecessary preflight/CORS issues
    const resp = await fetch(`${API_BASE_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
      headers: { ...authHeaders() },
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || `HTTP ${resp.status}`);
    }
    const data = await resp.json();
    return data?.users || data || [];
  },
  follow: (username) => fetchJson(`/api/users/${encodeURIComponent(username)}/follow`, { method: "POST" }),
  unfollow: (username) => fetchJson(`/api/users/${encodeURIComponent(username)}/follow`, { method: "DELETE" }),
  followers: (username) => fetchJson(`/api/users/${encodeURIComponent(username)}/followers`),
  following: (username) => fetchJson(`/api/users/${encodeURIComponent(username)}/following`),
  discover: () => fetchJson("/api/users/discover"),
  uploadAvatar: async (file) => {
    const form = new FormData();
    form.append("avatar", file);
    const resp = await fetch(`${API_BASE_URL}/api/profile/avatar`, {
      method: "POST",
      headers: { ...authHeaders() },
      body: form,
    });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json();
  },
};
