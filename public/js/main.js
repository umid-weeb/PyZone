import { initEditor } from "./editor.js";
import { loadProblemList, openProblem } from "./problems.js";
import { handleRun, handleSubmit, renderResultMessage } from "./runner.js";
import { requireAuth } from "./auth.js";

const ui = {};

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await requireAuth("/arena.html");
  if (!ok) return;
  collectUi();
  renderResultMessage(ui, "Loading problems...");
  try {
    const { authApi } = await import("./api.js");
    const me = await authApi.me().catch(() => null);
    if (me && ui.userAvatar) ui.userAvatar.textContent = (me.username || "U")[0].toUpperCase();
  } catch {}
  await initEditor(ui.editorHost);
  await loadProblemList(ui);
  if (ui.listContainer.firstChild) ui.listContainer.firstChild.click();
  bindEvents();
});

function collectUi() {
  ui.listContainer = document.getElementById("problem-list-inner");
  ui.listSkeleton = document.getElementById("problem-list-skeleton") || { hidden: true };
  ui.problemSkeleton = document.getElementById("description-loading");
  ui.title = document.getElementById("problem-title");
  ui.difficulty = document.getElementById("problem-difficulty");
  ui.meta = document.getElementById("problem-meta");
  ui.description = document.getElementById("problem-description");
  ui.visibleTests = document.getElementById("testcase-viewer");
  ui.resultSummary = document.getElementById("result-summary");
  ui.resultDetails = document.getElementById("result-details");
  ui.statusChip = document.getElementById("submission-status-chip");
  ui.runBtn = document.getElementById("run-solution");
  ui.submitBtn = document.getElementById("submit-solution");
  ui.editorHost = document.getElementById("arena-editor");
  ui.userAvatar = document.getElementById("user-avatar");
  ui.userMenu = document.getElementById("user-menu");
  ui.logoutBtn = document.getElementById("logout-btn");
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
}
