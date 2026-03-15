import { authApi, clearToken, getToken, setToken, fetchJson } from "./api.js";

const LOGIN_PATH = "/login";
const REGISTER_PATH = "/register";

function extractAuthToken(response) {
  return (
    response?.token ||
    response?.access_token ||
    response?.jwt ||
    response?.access ||
    response?.data?.token ||
    ""
  );
}

function persistAuthToken(token) {
  if (!token || token === "undefined") {
    throw new Error("Auth token missing from server response");
  }
  setToken(token);
  localStorage.setItem("token", token);
  localStorage.setItem("auth_token", token);
  localStorage.setItem("userToken", token);
  localStorage.setItem("arena_jwt", token);
  localStorage.setItem("access_token", token);
  return token;
}

export async function requireAuth(redirectBack = "/zone") {
  const token = getToken();
  if (!token) {
    window.location.href = `${LOGIN_PATH}?next=${encodeURIComponent(redirectBack)}`;
    return false;
  }
  try {
    await authApi.me();
    return true;
  } catch {
    clearToken();
    window.location.href = `${LOGIN_PATH}?next=${encodeURIComponent(redirectBack)}`;
    return false;
  }
}

export async function login(username, password) {
  const response = await authApi.login({ username, password });
  console.log("LOGIN RESPONSE:", response);
  const ticket = extractAuthToken(response);
  persistAuthToken(ticket);
  console.log("Saved token:", localStorage.getItem("token"));
  return response;
}

export async function register(payload) {
  const response = await authApi.register(payload);
  console.log("REGISTER RESPONSE:", response);
  const ticket = extractAuthToken(response);
  persistAuthToken(ticket);
  console.log("Saved token:", localStorage.getItem("token"));
  return response;
}

export async function logout() {
  try {
    // Call the backend logout endpoint to validate the token
    await fetchJson("/api/logout", { method: "POST" });
  } catch (error) {
    // Continue with logout even if backend call fails
    console.warn("Logout endpoint failed:", error);
  }
  
  // Clear all local storage and session storage
  clearToken();
  localStorage.removeItem("arena_pending_action");
  localStorage.removeItem("arena_pending_problem");
  localStorage.removeItem("access_token");
  localStorage.removeItem("userToken");
  localStorage.removeItem("arena_jwt");
  sessionStorage.clear();
  
  // Update UI to show logged out state
  updateUIForLogout();
  
  // Redirect to arena page
  window.location.href = "/zone";
}

function updateUIForLogout() {
  // Update the UI to reflect logged out state
  const userPanel = document.getElementById("user-panel");
  const userMenu = document.getElementById("user-menu");
  const authActions = document.getElementById("auth-actions");
  const usernameLabel = document.getElementById("navbar-username");
  const userAvatarImg = document.getElementById("user-avatar-img");
  const userAvatarFallback = document.getElementById("user-avatar-fallback");
  
  if (userPanel) userPanel.hidden = false;
  if (userMenu) {
    userMenu.innerHTML = `
      <a href="${LOGIN_PATH}" id="login-link">Login</a>
      <a href="${REGISTER_PATH}" id="signup-link">Sign Up</a>
    `;
  }
  if (authActions) authActions.hidden = true;
  if (usernameLabel) usernameLabel.textContent = "";
  if (userAvatarImg) userAvatarImg.hidden = true;
  if (userAvatarFallback) {
    userAvatarFallback.hidden = false;
    userAvatarFallback.textContent = "U";
  }
}
