import {
  clearStoredToken,
  readStoredToken,
  writeStoredToken,
} from "./storage.js";

export const API_BASE_URL =
  import.meta.env.VITE_ARENA_API_BASE || "https://python-editor-b87c.onrender.com";

async function request(path, options = {}) {
  const token = options.token ?? readStoredToken();
  const headers = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body,
  });

  const raw = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = raw
    ? isJson
      ? JSON.parse(raw)
      : (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return raw;
          }
        })()
    : null;

  if (!response.ok) {
    const message =
      (typeof data === "object" && data && (data.detail || data.message)) ||
      (typeof data === "string" && data) ||
      `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function extractToken(payload) {
  const token =
    payload?.token ||
    payload?.access_token ||
    payload?.jwt ||
    payload?.access ||
    payload?.data?.token ||
    "";
  if (!token) {
    throw new Error("Auth token missing from server response");
  }
  return token;
}

export const authApi = {
  async login(credentials) {
    const payload = await request("/api/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    const token = extractToken(payload);
    writeStoredToken(token);
    return { ...payload, token };
  },
  async register(credentials) {
    const payload = await request("/api/register", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    const token = extractToken(payload);
    writeStoredToken(token);
    return { ...payload, token };
  },
  me(token) {
    return request("/api/me", { token });
  },
  async logout(token) {
    try {
      await request("/api/logout", { method: "POST", token });
    } finally {
      clearStoredToken();
    }
  },
};

export const arenaApi = {
  async getProblems() {
    const data = await request("/api/problems?per_page=200");
    return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  },
  async getProblem(problemKey) {
    try {
      return await request(`/api/problems/${encodeURIComponent(problemKey)}`);
    } catch (error) {
      if (error?.status === 404) {
        return request(`/api/problem/${encodeURIComponent(problemKey)}`);
      }
      throw error;
    }
  },
  runSolution(problemSlug, code, language) {
    return request("/api/run", {
      method: "POST",
      body: JSON.stringify(buildSubmissionPayload(problemSlug, code, language)),
    });
  },
  submitSolution(problemSlug, code, language) {
    return request("/api/submit", {
      method: "POST",
      body: JSON.stringify(buildSubmissionPayload(problemSlug, code, language)),
    });
  },
  getSubmission(submissionId, token) {
    return request(`/api/submission/${submissionId}`, { token });
  },
  async pollSubmission(submissionId, token) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const payload = await arenaApi.getSubmission(submissionId, token).catch(() => null);
      if (!payload) {
        await delay(700);
        continue;
      }
      if (payload.status === "queued" || payload.status === "running") {
        await delay(800);
        continue;
      }
      return payload;
    }
    throw new Error("Submission polling timed out");
  },
};

export const userApi = {
  searchUsers(query) {
    return request(`/api/users/search?q=${encodeURIComponent(query)}`).then((payload) => payload?.users || []);
  },
  getPublicProfile(username) {
    return request(`/api/users/${encodeURIComponent(username)}`);
  },
  getActivity() {
    return request("/api/user/activity");
  },
  getSubmissions() {
    return request("/api/user/submissions");
  },
  getLeaderboard() {
    return request("/api/leaderboard");
  },
  updateProfile(payload) {
    return request("/api/user/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  updatePassword(payload) {
    return request("/api/user/password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async uploadAvatar(file) {
    const body = new FormData();
    body.append("file", file);
    return request("/api/user/avatar", {
      method: "POST",
      body,
    });
  },
  requestPasswordReset(phone) {
    return request("/api/password/reset", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
  },
  verifyPasswordReset(phone, code) {
    return request("/api/password/reset/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    });
  },
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSubmissionPayload(problemSlug, code, language) {
  const contestId = (() => {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return params.get("contest") || "";
    } catch {
      return "";
    }
  })();
  return {
    code,
    language,
    problemSlug,
    problem_id: problemSlug,
    contest_id: contestId || undefined,
  };
}
