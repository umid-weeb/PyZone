
import { initEditor } from "./editor.js";
import { loadProblemList, openProblem } from "./problems.js";
import { handleRun, handleSubmit, renderResultMessage } from "./runner.js";
import { getToken } from "./api.js";

// Import Vue authentication UI
import "./auth-ui.js";

const ui = {};
let navSearchVersion = 0;

document.addEventListener("DOMContentLoaded", async () => {
  collectUi();
  renderResultMessage(ui, "Loading problems...");
  hydrateUser();
  await initEditor(ui.editorHost);
  const problems = await loadProblemList(ui);
  const initialId = pickInitialProblemId(problems);
  if (initialId) {
    await openProblem(ui, initialId);
  } else if (ui.listContainer.firstChild) {
    ui.listContainer.firstChild.click();
  }
  await resumePendingAction();
  bindEvents();
  bindShortcuts();
});

function collectUi() {
  ui.listContainer = document.getElementById("problem-list-inner");
  ui.listSkeleton = document.getElementById("problem-list-skeleton") || { hidden: true };
  ui.problemSkeleton = document.getElementById("description-loading");
  ui.listMeta = document.getElementById("problem-list-meta");
  ui.title = document.getElementById("problem-title");
  ui.difficulty = document.getElementById("problem-difficulty");
  ui.meta = document.getElementById("problem-meta");
  ui.description = document.getElementById("problem-description");
  ui.visibleTests = document.getElementById("testcase-viewer");
  ui.visibleCaseCount = document.getElementById("visible-case-count");
  ui.resultSummary = document.getElementById("result-summary");
  ui.resultDetails = document.getElementById("result-details");
  ui.statusChip = document.getElementById("submission-status-chip");
  ui.runBtn = document.getElementById("run-solution");
  ui.submitBtn = document.getElementById("submit-solution");
  ui.editorHost = document.getElementById("arena-editor");
  ui.userAvatar = document.getElementById("user-avatar");
  ui.userAvatarImg = document.getElementById("user-avatar-img");
  ui.userAvatarFallback = document.getElementById("user-avatar-fallback");
  ui.usernameLabel = document.getElementById("navbar-username");
  ui.userMenu = document.getElementById("user-menu");
  ui.userPanel = document.getElementById("user-panel");
  ui.authActions = document.getElementById("auth-actions");
  ui.logoutBtn = document.getElementById("logout-btn");
  ui.authModal = document.getElementById("auth-modal");
  ui.authModalClose = document.getElementById("auth-modal-close");
  ui.authModalSignin = document.getElementById("auth-modal-signin");
  ui.authModalSignup = document.getElementById("auth-modal-signup");
  ui.authModalContinue = document.getElementById("auth-modal-continue");
  ui.searchInput = document.getElementById("problem-search");
  ui.difficultyFilters = document.querySelectorAll("[data-difficulty]");
  ui.languageSelect = document.getElementById("language-select");
  ui.navUserSearch = document.getElementById("nav-user-search");
  ui.navSearchResults = document.getElementById("nav-search-results");
  ui.backToListBtn = document.getElementById("back-to-list-btn");
}

function bindEvents() {
  ui.runBtn.addEventListener("click", () => handleRun(ui));
  ui.submitBtn.addEventListener("click", () => handleSubmit(ui));
  if (ui.userAvatar && ui.userMenu) {
    ui.userAvatar.addEventListener("click", toggleUserMenu);
  }
  if (ui.logoutBtn) {
    ui.logoutBtn.addEventListener("click", () => {
      import("./auth.js").then(({ logout }) => logout());
    });
  }
  if (ui.authModalClose) ui.authModalClose.addEventListener("click", closeAuthModal);
  if (ui.authModalContinue) ui.authModalContinue.addEventListener("click", closeAuthModal);
  if (ui.authModalSignin) ui.authModalSignin.addEventListener("click", () => redirectToAuth("login.html"));
  if (ui.authModalSignup) ui.authModalSignup.addEventListener("click", () => redirectToAuth("register.html"));
  if (ui.backToListBtn) {
    ui.backToListBtn.addEventListener("click", () => {
      // Hide description and show list
      if (ui.description) ui.description.classList.remove("is-visible");
      if (ui.descriptionLoading) ui.descriptionLoading.classList.remove("is-hidden");
      if (ui.problemTitle) ui.problemTitle.textContent = "Problem loading...";
      if (ui.problemDifficulty) ui.problemDifficulty.textContent = "Easy";
      if (ui.problemMeta) ui.problemMeta.textContent = "";
      
      // Clear editor and results
      if (ui.resultSummary) ui.resultSummary.textContent = "Run yoki Submit tugmasini bosing.";
      if (ui.resultDetails) ui.resultDetails.textContent = "";
      if (ui.statusChip) ui.statusChip.textContent = "Idle";
      ui.statusChip.className = "result-chip";
      
      // Reset URL
      const url = new URL(window.location);
      url.searchParams.delete("problem");
      window.history.replaceState({}, "", url.toString());
      
      // Reset active state on list items
      const activeItems = document.querySelectorAll(".problem-list-item.is-active");
      activeItems.forEach(item => item.classList.remove("is-active"));
    });
  }
  document.addEventListener("click", (e) => {
    if (e.target === ui.authModal) closeAuthModal();
    if (ui.userMenu && ui.userMenu.classList.contains("is-open")) {
      const targetInside = e.target.closest("#user-menu") || e.target.closest("#user-avatar");
      if (!targetInside) ui.userMenu.classList.remove("is-open");
    }
    if (ui.navSearchResults && !ui.navSearchResults.hidden) {
      const inside = e.target.closest("#nav-search-results") || e.target.closest("#nav-user-search");
      if (!inside) ui.navSearchResults.hidden = true;
    }
  });
  if (ui.searchInput) {
    ui.searchInput.addEventListener("input", (e) => {
      import("./problems.js").then(({ updateSearch, renderProblemList }) => {
        updateSearch(e.target.value || "");
        renderProblemList(ui);
      });
    });
  }
  if (ui.difficultyFilters?.length) {
    ui.difficultyFilters.forEach((btn) => {
      btn.addEventListener("click", () => {
        const diff = btn.dataset.difficulty;
        import("./problems.js").then(({ updateDifficulty, renderProblemList }) => {
          updateDifficulty(diff);
          renderProblemList(ui);
        });
        ui.difficultyFilters.forEach((b) => b.classList.toggle("is-active", b === btn));
      });
    });
  }
  if (ui.languageSelect) {
    const savedLang = localStorage.getItem("arena_language");
    if (savedLang) ui.languageSelect.value = savedLang;
    ui.languageSelect.addEventListener("change", (e) => {
      localStorage.setItem("arena_language", e.target.value);
    });
  }

  if (ui.navUserSearch) {
    let searchTimer = null;
    ui.navUserSearch.addEventListener("input", (e) => {
      const q = e.target.value.trim();
      if (!q) {
        ui.navSearchResults.hidden = true;
        ui.navSearchResults.innerHTML = "";
        navSearchVersion += 1; // cancel inflight responses
        return;
      }
      clearTimeout(searchTimer);
      const currentVersion = ++navSearchVersion;
      searchTimer = setTimeout(() => runUserSearch(q, currentVersion), 300);
    });
  }
}

function bindShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ui.runBtn.click();
    }
    if (e.ctrlKey && e.shiftKey && e.key === "Enter") {
      e.preventDefault();
      ui.submitBtn.click();
    }
    if (e.key === "Escape" && ui.userMenu && ui.userMenu.classList.contains("is-open")) {
      ui.userMenu.classList.remove("is-open");
    }
  });
}

function hydrateUser() {
  if (!getToken()) {
    showLoggedOutUI();
    return;
  }
  import("./api.js").then(({ authApi }) =>
    authApi
      .me()
      .then((me) => {
        const letter = (me?.username || "U")[0].toUpperCase();
        ui.userAvatarFallback.textContent = letter;
        if (me?.avatar_url && ui.userAvatarImg) {
          ui.userAvatarImg.src = me.avatar_url;
          ui.userAvatarImg.hidden = false;
          ui.userAvatarFallback.hidden = true;
        } else if (ui.userAvatarImg) {
          ui.userAvatarImg.src = "/assets/default-avatar.png";
          ui.userAvatarImg.hidden = false;
          ui.userAvatarFallback.hidden = true;
        }
        showLoggedInUI();
      })
      .catch(() => {
        showLoggedOutUI();
      })
  );
}

function toggleUserMenu() {
  if (!ui.userMenu) return;
  ui.userMenu.classList.toggle("is-open");
}

async function runUserSearch(query, version) {
  if (!ui.navSearchResults) return;
  const currentInput = ui.navUserSearch?.value.trim() || "";
  if (!currentInput) {
    ui.navSearchResults.hidden = true;
    ui.navSearchResults.innerHTML = "";
    return;
  }
  ui.navSearchResults.hidden = false;
  ui.navSearchResults.innerHTML = `<div class="muted">Searching...</div>`;
  try {
    const { userApi } = await import("./api.js");
    const results = await userApi.searchUsers(query);
    if (version !== navSearchVersion || (ui.navUserSearch?.value.trim() || "") !== query) {
      return; // stale response
    }
    if (!results?.length) {
      ui.navSearchResults.innerHTML = `<div class="muted">No users found</div>`;
      return;
    }
    ui.navSearchResults.innerHTML = "";
    results.slice(0, 8).forEach((u) => {
      const card = document.createElement("div");
      card.className = "search-card";
      card.innerHTML = `
        <div class="search-avatar">
          ${u.avatar_url ? `<img src="${u.avatar_url}" alt="${u.username}">` : `<span>${(u.username || "U")[0].toUpperCase()}</span>`}
        </div>
        <div class="search-meta">
          <div>${u.username || ""}</div>
          <div class="muted">${u.country || ""}</div>
        </div>
        <div class="muted">${u.solved_total ?? "-"}</div>
      `;
      card.addEventListener("click", () => {
        window.location.href = `/profile.html?username=${encodeURIComponent(u.username)}`;
      });
      ui.navSearchResults.appendChild(card);
    });
  } catch (err) {
    ui.navSearchResults.innerHTML = `<div class="muted">Search failed</div>`;
  }
}

function pickInitialProblemId(problems) {
  const urlProblem = new URLSearchParams(window.location.search).get("problem");
  if (urlProblem) return urlProblem;
  const stored = localStorage.getItem("arena_last_problem");
  if (stored) return stored;
  if (Array.isArray(problems) && problems.length) return problems[0].id;
  return null;
}

export function openAuthModal() {
  if (!ui.authModal) return;
  ui.authModal.removeAttribute("hidden");
}

export function closeAuthModal() {
  if (!ui.authModal) return;
  ui.authModal.setAttribute("hidden", "true");
}

function redirectToAuth(path) {
  const params = new URLSearchParams();
  const currentParams = new URLSearchParams(window.location.search);
  const currentProblem = currentParams.get("problem") || localStorage.getItem("arena_last_problem");
  let next = "/arena.html";
  if (currentProblem) {
    next += `?problem=${encodeURIComponent(currentProblem)}`;
  }
  const pending = localStorage.getItem("arena_pending_action");
  if (pending) {
    next += next.includes("?") ? `&pending=${encodeURIComponent(pending)}` : `?pending=${encodeURIComponent(pending)}`;
  }
  params.set("next", next);
  window.location.href = `/${path}?${params.toString()}`;
}

async function resumePendingAction() {
  const pending = localStorage.getItem("arena_pending_action") || new URLSearchParams(window.location.search).get("pending");
  if (pending !== "submit" || !getToken()) return;
  const pendingProblem = localStorage.getItem("arena_pending_problem") || new URLSearchParams(window.location.search).get("problem");
  if (pendingProblem) {
    try {
      await openProblem(ui, pendingProblem);
    } catch (_) {
      /* ignore open failures; we still attempt submit on current problem */
    }
  }
  localStorage.removeItem("arena_pending_action");
  localStorage.removeItem("arena_pending_problem");
  setTimeout(() => handleSubmit(ui), 150);
}

function showLoggedOutUI() {
  buildLoggedOutMenu();
  if (ui.userPanel) ui.userPanel.hidden = false;
  if (ui.usernameLabel) ui.usernameLabel.textContent = "";
  if (ui.userAvatarImg) ui.userAvatarImg.hidden = true;
  if (ui.userAvatarFallback) {
    ui.userAvatarFallback.hidden = false;
    ui.userAvatarFallback.textContent = "U";
  }
  if (ui.authActions) ui.authActions.hidden = true;
}

function showLoggedInUI() {
  buildLoggedInMenu();
  if (ui.userPanel) ui.userPanel.hidden = false;
  if (ui.authActions) ui.authActions.hidden = true;
}

function buildLoggedOutMenu() {
  if (!ui.userMenu) return;
  ui.userMenu.innerHTML = `
    <a href="/login.html">Login</a>
    <a href="/register.html">Sign Up</a>
  `;
}

function buildLoggedInMenu() {
  if (!ui.userMenu) return;
  ui.userMenu.innerHTML = `
    <a href="/profile.html">Profile</a>
    <a href="/submissions.html">Submissions</a>
    <a href="/leaderboard.html">Leaderboard</a>
    <button type="button" id="logout-btn">Logout</button>
  `;
  ui.logoutBtn = document.getElementById("logout-btn");
  if (ui.logoutBtn) {
    ui.logoutBtn.addEventListener("click", () => {
      import("./auth.js").then(({ logout }) => logout());
    });
  }
}
