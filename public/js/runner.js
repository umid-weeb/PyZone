import { runSolution, submitSolution, API_BASE_URL } from "./api.js";
import { getCode } from "./editor.js";
import { getCurrentProblemId } from "./problems.js";

export async function handleRun(ui) {
  const problemId = getCurrentProblemId();
  if (!problemId) {
    renderResultMessage(ui, "Select a problem first.");
    return;
  }
  ui.runBtn.disabled = true;
  ui.runBtn.textContent = "Running...";
  try {
    const data = await runSolution(problemId, getCode());
    renderRunResult(ui, data);
  } catch (error) {
    renderResultMessage(ui, "Execution failed");
  } finally {
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
  ui.submitBtn.disabled = true;
  ui.submitBtn.textContent = "Submitting...";
  try {
    const data = await submitSolution(problemId, getCode());
    await pollSubmission(ui, data.submission_id);
  } catch (error) {
    renderResultMessage(ui, "Execution failed");
  } finally {
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
  ui.resultSummary.textContent = "Run output:";
  ui.resultDetails.textContent = data.output || JSON.stringify(data);
  ui.statusChip.textContent = "Run";
  ui.statusChip.className = "result-chip";
}

function renderSubmitResult(ui, data) {
  ui.resultSummary.textContent = `${data.verdict || data.status}`;
  ui.resultDetails.textContent = data.case_results
    ? data.case_results
        .map(
          (c, i) =>
            `Case ${i + 1}: ${c.verdict || (c.passed ? "Accepted" : "Wrong Answer")}`
        )
        .join("\n")
    : "";
  ui.statusChip.textContent = data.verdict || data.status;
  const good = (data.verdict || "").toLowerCase() === "accepted";
  ui.statusChip.className = `result-chip ${good ? "status-success" : "status-error"}`;
}

export function renderResultMessage(ui, text) {
  ui.resultSummary.textContent = text;
  ui.resultDetails.textContent = "";
  ui.statusChip.textContent = "Info";
  ui.statusChip.className = "result-chip";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
