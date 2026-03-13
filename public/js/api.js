export const API_BASE_URL = "https://python-editor-b87c.onrender.com";
const TOKEN_KEY = "arena_jwt";

let problemsCache = null;
const problemDetailCache = new Map();

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function fetchJson(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const resp = await fetch(url, {
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) },
    ...options,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `HTTP ${resp.status}`);
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

export async function runSolution(problemId, code) {
  return fetchJson("/api/run", {
    method: "POST",
    body: JSON.stringify({ problem_id: problemId, code }),
  });
}

export async function submitSolution(problemId, code) {
  return fetchJson("/api/submit", {
    method: "POST",
    body: JSON.stringify({ problem_id: problemId, code }),
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
  activity: () => fetchJson("/user/activity"),
  submissions: () => fetchJson("/user/submissions"),
  leaderboard: () => fetchJson("/leaderboard"),
};
