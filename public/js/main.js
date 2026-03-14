import { initEditor } from "./editor.js";
import { loadProblemList, openProblem } from "./problems.js";
import { handleRun, handleSubmit, renderResultMessage } from "./runner.js";
import { getToken } from "./api.js";

const ui = {};

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
  ui.userMenu = document.getElementById("user-menu");
  ui.logoutBtn = document.getElementById("logout-btn");
  ui.authModal = document.getElementById("auth-modal");
  ui.authModalClose = document.getElementById("auth-modal-close");
  ui.authModalSignin = document.getElementById("auth-modal-signin");
  ui.authModalSignup = document.getElementById("auth-modal-signup");
  ui.authModalContinue = document.getElementById("auth-modal-continue");
  ui.searchInput = document.getElementById("problem-search");
  ui.difficultyFilters = document.querySelectorAll("[data-difficulty]");
  ui.languageSelect = document.getElementById("language-select");
}

function bindEvents() {
  ui.runBtn.addEventListener("click", () => handleRun(ui));
  ui.submitBtn.addEventListener("click", () => handleSubmit(ui));
  if (ui.userAvatar && ui.userMenu) {
    ui.userAvatar.addEventListener("click", () => {
      ui.userMenu.hidden = !ui.userMenu.hidden;
    });
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
  document.addEventListener("click", (e) => {
    if (e.target === ui.authModal) closeAuthModal();
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
  });
}

function hydrateUser() {
  if (!getToken() || !ui.userAvatar) return;
  import("./api.js").then(({ authApi }) =>
    authApi
      .me()
      .then((me) => {
        if (me?.username) ui.userAvatar.textContent = (me.username || "U")[0].toUpperCase();
      })
      .catch(() => {})
  );
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
  const params = new URLSearchParams(window.location.search);
  const currentProblem = params.get("problem") || localStorage.getItem("arena_last_problem");
  if (currentProblem) params.set("problem", currentProblem);
  params.set("next", "/arena.html");
  window.location.href = `/${path}?${params.toString()}`;
}
