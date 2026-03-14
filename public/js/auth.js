import { authApi, clearToken, getToken, setToken, fetchJson } from "./api.js";

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
  const response = await authApi.login({ username, password });
  // Look inside the box for the VIP sticker!
  const ticket = response?.access_token || response?.token || response?.jwt;
  if (ticket && ticket !== "undefined") setToken(ticket);
  return response;
}

export async function register(payload) {
  const response = await authApi.register(payload);
  // New friends get stickers too!
  const ticket = response?.access_token || response?.token || response?.jwt;
  if (ticket && ticket !== "undefined") setToken(ticket);
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
  sessionStorage.clear();
  
  // Update UI to show logged out state
  updateUIForLogout();
  
  // Redirect to arena page
  window.location.href = "/arena.html";
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
      <a href="/login.html" id="login-link">Login / Sign Up</a>
      <a href="/register.html">Sign Up</a>
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
