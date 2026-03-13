import { getProblems, getProblem } from "./api.js";
import { setCode } from "./editor.js";
import { renderResultMessage } from "./runner.js";

const state = {
  problems: [],
  current: null,
  cache: new Map(),
};

export async function loadProblemList(ui) {
  ui.listSkeleton.hidden = false;
  ui.listContainer.innerHTML = "";
  try {
    const data = await getProblems();
    state.problems = Array.isArray(data.items) ? data.items : data;
    renderProblemList(ui);
    ui.listSkeleton.hidden = true;
    return state.problems;
  } catch (error) {
    ui.listSkeleton.hidden = true;
    renderResultMessage(ui, "Backend connection error");
    throw error;
  }
}

export function renderProblemList(ui) {
  ui.listContainer.innerHTML = "";
  state.problems.forEach((problem) => {
    const item = document.createElement("button");
    item.className = "problem-card";
    item.innerHTML = `
      <div class="problem-title">${escapeHtml(problem.title || problem.id)}</div>
      <div class="problem-meta">
        <span class="pill pill-${(problem.difficulty || "easy").toLowerCase()}">
          ${(problem.difficulty || "EASY").toUpperCase()}
        </span>
        <span class="problem-id">${problem.id}</span>
      </div>
    `;
    item.addEventListener("click", () => openProblem(ui, problem.id));
    ui.listContainer.appendChild(item);
  });
}

export async function openProblem(ui, problemId) {
  if (state.cache.has(problemId)) {
    await renderProblemDetail(ui, state.cache.get(problemId));
    return;
  }
  ui.problemSkeleton.hidden = false;
  ui.description.innerHTML = "";
  try {
    const data = await getProblem(problemId);
    state.cache.set(problemId, data);
    await renderProblemDetail(ui, data);
  } catch (error) {
    renderResultMessage(ui, "Backend connection error");
    throw error;
  } finally {
    ui.problemSkeleton.hidden = true;
  }
}

async function renderProblemDetail(ui, data) {
  state.current = data;
  ui.title.textContent = data.title || data.id;
  ui.difficulty.textContent = (data.difficulty || "easy").toUpperCase();
  ui.difficulty.className = `pill pill-${(data.difficulty || "easy").toLowerCase()}`;
  ui.meta.innerHTML = [
    data.time_limit_seconds ? `Time: ${data.time_limit_seconds}s` : "",
    data.memory_limit_mb ? `Memory: ${data.memory_limit_mb}MB` : "",
    data.tags ? `Tags: ${data.tags.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  ui.description.innerHTML = window.marked
    ? window.marked.parse(data.description || "")
    : escapeHtml(data.description || "");
  ui.visibleTests.textContent = "";
  (data.visible_testcases || []).forEach((tc, idx) => {
    const block = document.createElement("div");
    block.className = "testcase-block";
    block.innerHTML = `
      <div class="testcase-title">Case ${idx + 1}</div>
      <pre><strong>Input</strong>\n${escapeHtml(tc.input || "")}</pre>
      <pre><strong>Expected</strong>\n${escapeHtml(tc.expected_output || "")}</pre>
    `;
    ui.visibleTests.appendChild(block);
  });
  setCode(data.starter_code);
  renderResultMessage(ui, "Ready. Write code and Run or Submit.");
}

export function getCurrentProblemId() {
  return state.current?.id;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
