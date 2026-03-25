const TOKEN_KEYS = ["userToken", "auth_token", "token", "arena_jwt", "access_token"];
const USERNAME_KEY = "arena_username";
const LANGUAGE_KEY = "arena_language";
const LAST_PROBLEM_KEY = "arena_last_problem";
const PENDING_ACTION_KEY = "arena_pending_action";
const PENDING_PROBLEM_KEY = "arena_pending_problem";

export function readStoredToken() {
  return TOKEN_KEYS.map((key) => localStorage.getItem(key)).find(Boolean) || "";
}

export function writeStoredToken(token) {
  TOKEN_KEYS.forEach((key) => localStorage.setItem(key, token));
}

export function clearStoredToken() {
  TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function getDraftKey(problemId) {
  return `arena_draft_${problemId}`;
}

export function readDraft(problemId, fallback = "") {
  if (!problemId) return fallback;
  return localStorage.getItem(getDraftKey(problemId)) || fallback;
}

export function writeDraft(problemId, code) {
  if (!problemId) return;
  localStorage.setItem(getDraftKey(problemId), code || "");
}

export function clearDraft(problemId) {
  if (!problemId) return;
  localStorage.removeItem(getDraftKey(problemId));
}

export function readLanguage() {
  return localStorage.getItem(LANGUAGE_KEY) || "python";
}

export function writeLanguage(language) {
  localStorage.setItem(LANGUAGE_KEY, language);
}

export function readLastProblem() {
  return localStorage.getItem(LAST_PROBLEM_KEY) || "";
}

export function writeLastProblem(problemId) {
  if (!problemId) return;
  localStorage.setItem(LAST_PROBLEM_KEY, problemId);
}

export function setPendingSubmission(problemId) {
  localStorage.setItem(PENDING_ACTION_KEY, "submit");
  if (problemId) {
    localStorage.setItem(PENDING_PROBLEM_KEY, problemId);
  }
}

export function readPendingSubmission() {
  const action = localStorage.getItem(PENDING_ACTION_KEY);
  const problemId = localStorage.getItem(PENDING_PROBLEM_KEY);
  if (action !== "submit") return null;
  return { action, problemId };
}

export function clearPendingSubmission() {
  localStorage.removeItem(PENDING_ACTION_KEY);
  localStorage.removeItem(PENDING_PROBLEM_KEY);
}

export function readStoredUsername() {
  return localStorage.getItem(USERNAME_KEY) || "";
}

export function writeStoredUsername(username) {
  localStorage.setItem(USERNAME_KEY, username);
}

export function clearStoredUsername() {
  localStorage.removeItem(USERNAME_KEY);
}
