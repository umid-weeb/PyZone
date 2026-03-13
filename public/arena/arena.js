const arenaState = {
  apiBase: window.ARENA_API_BASE || "/api",
  problems: [],
  filteredProblems: [],
  currentProblem: null,
  currentVisibleTests: [],
  activeTestIndex: 0,
  activeSubmissionId: null,
  pollTimer: null,
  editor: null,
};

const arenaElements = {};

document.addEventListener("DOMContentLoaded", () => {
  initializeArena().catch((error) => {
    console.error("Arena initialization failed:", error);
    updateResultPanel(
      "Xatolik",
      "status-error",
      "Arena yuklanmadi.",
      `${error.message}\n\nBackend ishga tushganini va /api endpoint mavjudligini tekshiring.`
    );
  });
});

async function initializeArena() {
  collectArenaElements();
  initializeArenaEditor();
  bindArenaEvents();
  await loadProblems();
}

function collectArenaElements() {
  arenaElements.problemSearch = document.getElementById("problem-search");
  arenaElements.refreshProblems = document.getElementById("refresh-problems");
  arenaElements.problemListMeta = document.getElementById("problem-list-meta");
  arenaElements.problemList = document.getElementById("problem-list");
  arenaElements.problemTitle = document.getElementById("problem-title");
  arenaElements.problemDifficulty = document.getElementById("problem-difficulty");
  arenaElements.problemMeta = document.getElementById("problem-meta");
  arenaElements.problemDescription = document.getElementById("problem-description");
  arenaElements.problemFunctionName = document.getElementById("problem-function-name");
  arenaElements.runButton = document.getElementById("run-solution");
  arenaElements.submitButton = document.getElementById("submit-solution");
  arenaElements.visibleCaseCount = document.getElementById("visible-case-count");
  arenaElements.testcaseTabs = document.getElementById("testcase-tabs");
  arenaElements.testcaseViewer = document.getElementById("testcase-viewer");
  arenaElements.submissionStatusChip = document.getElementById("submission-status-chip");
  arenaElements.resultSummary = document.getElementById("result-summary");
  arenaElements.resultDetails = document.getElementById("result-details");
}

function initializeArenaEditor() {
  arenaState.editor = CodeMirror.fromTextArea(document.getElementById("arena-editor"), {
    mode: "python",
    theme: "monokai",
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    lineWrapping: false,
    matchBrackets: true,
    autoCloseBrackets: true,
    styleActiveLine: true,
    extraKeys: {
      Tab: (cm) => cm.replaceSelection("    "),
    },
  });

  arenaState.editor.setValue(
    [
      "class Solution:",
      "    def solve(self):",
      "        pass",
    ].join("\n")
  );
}

function bindArenaEvents() {
  arenaElements.problemSearch.addEventListener("input", () => {
    renderProblemList(arenaElements.problemSearch.value.trim().toLowerCase());
  });

  arenaElements.refreshProblems.addEventListener("click", async () => {
    try {
      await loadProblems(true);
    } catch (error) {
      handleArenaError(error, "Problem list yangilanmadi.");
    }
  });

  arenaElements.runButton.addEventListener("click", async () => {
    try {
      await startSubmission("run");
    } catch (error) {
      handleArenaError(error, "Run bajarilmadi.");
    }
  });

  arenaElements.submitButton.addEventListener("click", async () => {
    try {
      await startSubmission("submit");
    } catch (error) {
      handleArenaError(error, "Submit bajarilmadi.");
    }
  });
}

async function loadProblems(forceRefresh = false) {
  arenaElements.problemListMeta.textContent = forceRefresh
    ? "GitHub dan yangilanmoqda..."
    : "Problemlar yuklanmoqda...";
  arenaElements.problemList.innerHTML = '<div class="empty-state">Yuklanmoqda...</div>';

  const suffix = forceRefresh ? "?refresh=1" : "";
  const response = await fetchArenaJson(`${arenaState.apiBase}/problems${suffix}`);
  const items = Array.isArray(response) ? response : response.items || [];

  arenaState.problems = items;
  renderProblemList(arenaElements.problemSearch.value.trim().toLowerCase());

  const activeId = arenaState.currentProblem?.id;
  const initialProblem = items.find((item) => item.id === activeId) || items[0];

  if (initialProblem) {
    await loadProblem(initialProblem.id);
  } else {
    arenaElements.problemListMeta.textContent =
      "Problem topilmadi. GitHub repo sozlamalarini tekshiring.";
    arenaElements.problemList.innerHTML =
      '<div class="empty-state">Hali problem kelmadi.</div>';
    updateResultPanel(
      "No Problems",
      "status-error",
      "Arena backend problem list qaytarmadi.",
      "GitHub repo ichida problems/<slug>/metadata.yaml tuzilmasi bo‘lishi kerak."
    );
  }
}

function renderProblemList(searchText = "") {
  const filtered = arenaState.problems.filter((problem) => {
    if (!searchText) {
      return true;
    }

    const haystack = [problem.title, problem.id, ...(problem.tags || [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(searchText);
  });

  arenaState.filteredProblems = filtered;
  arenaElements.problemListMeta.textContent = `${filtered.length} ta easy problem`;

  if (!filtered.length) {
    arenaElements.problemList.innerHTML =
      '<div class="empty-state">Qidiruv bo‘yicha problem topilmadi.</div>';
    return;
  }

  arenaElements.problemList.innerHTML = "";
  const fragment = document.createDocumentFragment();

  filtered.forEach((problem) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `problem-list-item${
      arenaState.currentProblem?.id === problem.id ? " active" : ""
    }`;
    item.innerHTML = `
      <div class="problem-list-title">${escapeHtml(problem.title)}</div>
      <div class="problem-list-meta-row">
        <span>${escapeHtml((problem.difficulty || "easy").toUpperCase())}</span>
        <span>${escapeHtml((problem.tags || []).slice(0, 2).join(", ") || "python")}</span>
      </div>
    `;
    item.addEventListener("click", async () => {
      try {
        await loadProblem(problem.id);
      } catch (error) {
        handleArenaError(error, "Problem ochilmadi.");
      }
    });
    fragment.appendChild(item);
  });

  arenaElements.problemList.appendChild(fragment);
}

async function loadProblem(problemId) {
  updateResultPanel("Loading", "", "Masala yuklanmoqda...", "");
  const problem = await fetchArenaJson(
    `${arenaState.apiBase}/problem/${encodeURIComponent(problemId)}`
  );

  arenaState.currentProblem = problem;
  arenaState.currentVisibleTests = problem.visible_testcases || [];
  arenaState.activeTestIndex = 0;

  arenaElements.problemTitle.textContent = problem.title || problem.id;
  arenaElements.problemDifficulty.textContent = (problem.difficulty || "easy").toUpperCase();
  arenaElements.problemFunctionName.textContent = problem.function_name || "Solution";
  arenaElements.problemDescription.innerHTML = marked.parse(problem.description || "");
  arenaElements.problemMeta.innerHTML = [
    problem.time_limit_seconds ? `Time limit: ${problem.time_limit_seconds}s` : "",
    problem.memory_limit_mb ? `Memory limit: ${problem.memory_limit_mb} MB` : "",
    problem.input_format ? `Input: ${escapeHtml(problem.input_format)}` : "",
    problem.output_format ? `Output: ${escapeHtml(problem.output_format)}` : "",
    Array.isArray(problem.tags) && problem.tags.length
      ? `Tags: ${escapeHtml(problem.tags.join(", "))}`
      : "",
  ]
    .filter(Boolean)
    .join("<br>");

  if (problem.starter_code) {
    arenaState.editor.setValue(problem.starter_code);
    arenaState.editor.clearHistory();
  }

  renderProblemList(arenaElements.problemSearch.value.trim().toLowerCase());
  renderVisibleTestcases();
  updateResultPanel("Idle", "", "Run yoki Submit tugmasini bosing.", "");
}

function renderVisibleTestcases() {
  const testcases = arenaState.currentVisibleTests;
  arenaElements.visibleCaseCount.textContent = `${testcases.length} case`;
  arenaElements.testcaseTabs.innerHTML = "";

  if (!testcases.length) {
    arenaElements.testcaseViewer.textContent = "Visible testcase topilmadi.";
    return;
  }

  testcases.forEach((testcase, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `testcase-tab${index === arenaState.activeTestIndex ? " active" : ""}`;
    tab.textContent = testcase.name || `Case ${index + 1}`;
    tab.addEventListener("click", () => {
      arenaState.activeTestIndex = index;
      renderVisibleTestcases();
    });
    arenaElements.testcaseTabs.appendChild(tab);
  });

  const activeCase = testcases[arenaState.activeTestIndex];
  arenaElements.testcaseViewer.textContent = [
    `Input\n${activeCase.input || "(empty)"}`,
    `Expected Output\n${activeCase.expected_output || "(empty)"}`,
  ].join("\n\n");
}

async function startSubmission(mode) {
  if (!arenaState.currentProblem) {
    updateResultPanel("Xatolik", "status-error", "Avval problem tanlang.", "");
    return;
  }

  const code = arenaState.editor.getValue();
  if (!code.trim()) {
    updateResultPanel("Xatolik", "status-error", "Kod bo‘sh.", "Starter code yoki yechim kiriting.");
    return;
  }

  setArenaBusy(true);
  updateResultPanel(
    mode === "submit" ? "Submitting" : "Running",
    "",
    mode === "submit"
      ? "Submission queue ga yuborildi..."
      : "Visible testlar ishga tushirildi...",
    ""
  );

  try {
    const response = await fetchArenaJson(`${arenaState.apiBase}/${mode}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        problem_id: arenaState.currentProblem.id,
        code,
        language: "python",
      }),
    });

    arenaState.activeSubmissionId = response.submission_id;
    await pollSubmission(response.submission_id);
  } catch (error) {
    setArenaBusy(false);
    updateResultPanel("Xatolik", "status-error", "Submission yuborilmadi.", error.message);
  }
}

async function pollSubmission(submissionId) {
  clearTimeout(arenaState.pollTimer);

  const payload = await fetchArenaJson(
    `${arenaState.apiBase}/submission/${encodeURIComponent(submissionId)}`
  );

  if (payload.status === "queued" || payload.status === "running") {
    updateResultPanel(
      payload.status === "running" ? "Running" : "Queued",
      "",
      buildLiveSummary(payload),
      "Judge worker testcase'larni ishlayapti..."
    );
    arenaState.pollTimer = setTimeout(() => {
      pollSubmission(submissionId).catch((error) => {
        setArenaBusy(false);
        updateResultPanel("Xatolik", "status-error", "Polling yiqildi.", error.message);
      });
    }, 1200);
    return;
  }

  setArenaBusy(false);
  renderSubmissionResult(payload);
}

function renderSubmissionResult(payload) {
  const verdict = payload.verdict || payload.status || "Unknown";
  const isSuccess = verdict === "Accepted";
  const statusClass = isSuccess ? "status-success" : verdict === "Idle" ? "" : "status-error";

  const summaryLines = [
    verdict,
    payload.runtime_ms != null ? `Runtime: ${payload.runtime_ms} ms` : "",
    payload.memory_kb != null ? `Memory: ${Math.max(1, Math.round(payload.memory_kb / 1024))} MB` : "",
    payload.total_count != null ? `Passed: ${payload.passed_count || 0} / ${payload.total_count}` : "",
  ].filter(Boolean);

  const caseResults = Array.isArray(payload.case_results) ? payload.case_results : [];
  const details = caseResults.length
    ? caseResults
        .map((item, index) => {
          const blocks = [
            `${item.name || `Case ${index + 1}`}: ${item.verdict || (item.passed ? "Passed" : "Failed")}`,
            item.hidden ? "Hidden testcase" : item.input ? `Input:\n${item.input}` : "",
            item.hidden ? "" : item.expected_output ? `Expected:\n${item.expected_output}` : "",
            item.actual_output ? `Actual:\n${item.actual_output}` : "",
            item.error ? `Error:\n${item.error}` : "",
          ].filter(Boolean);
          return blocks.join("\n");
        })
        .join("\n\n----------------\n\n")
    : payload.error_text || "Judge tafsilot bermadi.";

  updateResultPanel(verdict, statusClass, summaryLines.join("\n"), details);
}

function buildLiveSummary(payload) {
  return [
    payload.status === "running" ? "Judge ishlayapti..." : "Queue'da kutyapti...",
    payload.problem_id ? `Problem: ${payload.problem_id}` : "",
    payload.mode ? `Mode: ${payload.mode}` : "",
    payload.created_at ? `Queued: ${new Date(payload.created_at).toLocaleString()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function updateResultPanel(label, statusClass, summary, details) {
  arenaElements.submissionStatusChip.textContent = label;
  arenaElements.submissionStatusChip.className = `result-chip${statusClass ? ` ${statusClass}` : ""}`;
  arenaElements.resultSummary.textContent = summary || "";
  arenaElements.resultDetails.textContent = details || "";
}

function setArenaBusy(isBusy) {
  arenaElements.runButton.disabled = isBusy;
  arenaElements.submitButton.disabled = isBusy;
  arenaElements.refreshProblems.disabled = isBusy;
}

function handleArenaError(error, summary) {
  console.error(error);
  setArenaBusy(false);
  updateResultPanel(
    "Xatolik",
    "status-error",
    summary,
    error instanceof Error ? error.message : String(error)
  );
}

async function fetchArenaJson(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `HTTP ${response.status}`);
  }

  return response.json();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
