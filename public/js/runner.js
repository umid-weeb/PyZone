import { runSolution, submitSolution, API_BASE_URL, getToken } from "./api.js";
import { getCode, saveDraft } from "./editor.js";
import { getCurrentProblemId } from "./problems.js";

export async function handleRun(ui) {
  const problemId = getCurrentProblemId();
  if (!problemId) {
    renderResultMessage(ui, "Select a problem first.");
    return;
  }
  saveDraft(problemId);
  toggleResultLoading(ui, true, "Running visible testcases...");
  ui.runBtn.disabled = true;
  ui.runBtn.textContent = "Running...";
  try {
    const data = await runSolution(problemId, getCode(), currentLanguage(ui));
    renderRunResult(ui, data);
  } catch (error) {
    renderResultMessage(ui, "Execution failed");
  } finally {
    toggleResultLoading(ui, false);
    ui.runBtn.disabled = false;
    ui.runBtn.textContent = "Run";
  }
}

export async function handleSubmit(ui) {
  const problemId = getCurrentProblemId();
  if (!problemId) {
    renderResultMessage(ui, "Select a problem first.");
    return;
  }
  saveDraft(problemId);
  if (!getToken()) {
    setPendingSubmit(problemId);
    openAuthModal();
    return;
  }
  toggleResultLoading(ui, true, "Submitting...");
  ui.submitBtn.disabled = true;
  ui.submitBtn.textContent = "Submitting...";
  try {
    const data = await submitSolution(problemId, getCode(), currentLanguage(ui));
    await pollSubmission(ui, data.submission_id);
  } catch (error) {
    renderResultMessage(ui, "Execution failed");
  } finally {
    toggleResultLoading(ui, false);
    ui.submitBtn.disabled = false;
    ui.submitBtn.textContent = "Submit";
  }
}

async function pollSubmission(ui, submissionId) {
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i += 1) {
    const resp = await fetch(`${API_BASE_URL}/api/submission/${submissionId}`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("arena_jwt") || ""}` },
    }).catch(() => null);
    if (!resp || !resp.ok) {
      await delay(600);
      continue;
    }
    const data = await resp.json();
    if (data.status === "queued" || data.status === "running") {
      renderResultMessage(ui, `Running... (${data.status})`);
      await delay(700);
      continue;
    }
    renderSubmitResult(ui, data);
    return;
  }
  renderResultMessage(ui, "Execution failed");
}

function renderRunResult(ui, data) {
  const status = data.status || (data.ok ? "Accepted" : "Output");
  ui.resultSummary.innerHTML = buildSummary(status, data.runtime_ms, data.memory_kb);
  ui.resultDetails.textContent = data.output || formatCaseResults(data.case_results) || JSON.stringify(data, null, 2);
  applyStatus(ui, status);
}

function renderSubmitResult(ui, data) {
  const status = data.verdict || data.status || "Result";
  ui.resultSummary.innerHTML = buildSummary(status, data.runtime_ms, data.memory_kb);
  ui.resultDetails.textContent = formatCaseResults(data.case_results) || "";
  applyStatus(ui, status);
}

export function renderResultMessage(ui, text) {
  ui.resultSummary.textContent = text;
  ui.resultDetails.textContent = "";
  ui.statusChip.textContent = "Info";
  ui.statusChip.className = "result-chip";
}

function buildSummary(status, runtimeMs, memoryKb) {
  const runtime = runtimeMs ? `${runtimeMs} ms` : "—";
  const memory = memoryKb ? `${Math.round(memoryKb)} KB` : "—";
  return `${status} • Runtime: ${runtime} • Memory: ${memory}`;
}

function formatCaseResults(cases = []) {
  if (!cases?.length) return "";
  return cases
    .map((c, i) => {
      const verdict = c.verdict || (c.passed ? "Accepted" : "Wrong Answer");
      const rt = c.runtime_ms ? `${c.runtime_ms} ms` : "";
      const mem = c.memory_kb ? `${Math.round(c.memory_kb)} KB` : "";
      const detail = [rt, mem].filter(Boolean).join(" · ");
      return `Case ${i + 1}: ${verdict}${detail ? ` (${detail})` : ""}`;
    })
    .join("\n");
}

function applyStatus(ui, status) {
  const normalized = (status || "").toLowerCase();
  let cls = "info";
  if (normalized.includes("accepted")) cls = "success";
  else if (normalized.includes("wrong")) cls = "danger";
  else if (normalized.includes("runtime")) cls = "warning";
  else if (normalized.includes("time")) cls = "purple";
  ui.statusChip.textContent = status || "Result";
  ui.statusChip.className = `result-chip status-${cls}`;
}

function toggleResultLoading(ui, isLoading, text = "Working...") {
  if (!ui.resultSummary || !ui.resultDetails) return;
  if (isLoading) {
    ui.resultSummary.innerHTML = `<span class="dot-spinner"></span> ${text}`;
    ui.resultDetails.textContent = "";
    ui.statusChip.textContent = "Running";
    ui.statusChip.className = "result-chip status-pending";
  } else {
    ui.statusChip.className = "result-chip";
  }
}

function openAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (!modal) return;
  const title = modal.querySelector("h2");
  const desc = modal.querySelector("p");
  if (title) title.textContent = "Tizimga kiring";
  if (desc) desc.textContent = "Masalani yuborish uchun avval tizimga kiring.";
  modal.removeAttribute("hidden");
}

function currentLanguage(ui) {
  return ui.languageSelect?.value || "python";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setPendingSubmit(problemId) {
  localStorage.setItem("arena_pending_action", "submit");
  if (problemId) {
    localStorage.setItem("arena_pending_problem", problemId);
  }
}
