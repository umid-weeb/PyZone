let pyodide;
let editor;
let autoSaveInterval;
let defaultCode = "";
let activeErrorLineNumber = null;
let activeErrorTextMarker = null;
let activeRunSession = null;
let activeDebugSession = null;
let activeDebugLineNumber = null;
let activeDebugSteps = [];
let activeDebugStepIndex = 0;
let debugRangeStartLine = null;
let debugRangeEndLine = null;
let debugRangeHighlightedStartLine = null;
let debugRangeHighlightedEndLine = null;
let debugRangeHighlightedBodyLines = [];
let pythonFormatterReady = false;

const INDENT_SIZE = 4;
const EDITOR_FONT_FAMILIES = {
  "IBM Plex Mono": '"IBM Plex Mono", monospace',
  "JetBrains Mono": '"JetBrains Mono", monospace',
  "Fira Code": '"Fira Code", monospace',
  "Victor Mono": '"Victor Mono", monospace',
  Inconsolata: '"Inconsolata", monospace',
  "Azeret Mono": '"Azeret Mono", monospace',
  "Source Code Pro": '"Source Code Pro", monospace',
  "Roboto Mono": '"Roboto Mono", monospace',
  "Space Mono": '"Space Mono", monospace',
  "Ubuntu Mono": '"Ubuntu Mono", monospace',
  "Courier Prime": '"Courier Prime", monospace',
  "Anonymous Pro": '"Anonymous Pro", monospace',
};
const EDITOR_FONT_SIZES = new Set([
  "12px",
  "14px",
  "16px",
  "18px",
  "20px",
  "22px",
  "24px",
]);
const DEFAULT_EDITOR_FONT_FAMILY = "IBM Plex Mono";
const DEFAULT_EDITOR_FONT_SIZE = "14px";
const DEBUG_MAX_STEPS = 420;

const PYTHON_KEYWORDS = [
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
  "print",
  "input",
  "len",
  "range",
  "str",
  "int",
  "float",
  "list",
  "dict",
  "set",
  "tuple",
  "bool",
  "type",
  "open",
  "file",
  "round",
  "abs",
  "all",
  "any",
  "sum",
  "min",
  "max",
  "sorted",
  "reversed",
  "enumerate",
  "zip",
  "map",
  "filter",
  "help",
];

const MATH_FUNCTIONS = [
  "math.sqrt",
  "math.pow",
  "math.floor",
  "math.ceil",
  "math.round",
  "math.sin",
  "math.cos",
  "math.tan",
  "math.asin",
  "math.acos",
  "math.atan",
  "math.log",
  "math.log10",
  "math.exp",
  "math.pi",
  "math.e",
  "math.degrees",
  "math.radians",
  "math.factorial",
];

const COMMON_PYTHON_NAMES = [...new Set([...PYTHON_KEYWORDS, "math"])];

function extractUserDefinedNames(code) {
  const names = new Set();
  const funcRegex = /def\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
  const classRegex = /class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
  const varRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g;
  const loopVarRegex = /for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in/g;
  const importRegex =
    /^\s*import\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*))?/gm;
  const fromImportRegex =
    /^\s*from\s+[a-zA-Z_][a-zA-Z0-9_.]*\s+import\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*))?/gm;
  const paramRegex = /def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(([^)]*)\)/g;
  let match;

  while ((match = funcRegex.exec(code)) !== null) {
    names.add(match[1]);
  }

  while ((match = classRegex.exec(code)) !== null) {
    names.add(match[1]);
  }

  while ((match = varRegex.exec(code)) !== null) {
    names.add(match[1]);
  }

  while ((match = loopVarRegex.exec(code)) !== null) {
    names.add(match[1]);
  }

  while ((match = importRegex.exec(code)) !== null) {
    names.add(match[2] || match[1]);
  }

  while ((match = fromImportRegex.exec(code)) !== null) {
    names.add(match[2] || match[1]);
  }

  while ((match = paramRegex.exec(code)) !== null) {
    const params = match[1]
      .split(",")
      .map((param) => param.trim())
      .map((param) => param.replace(/[:=].*$/, "").replace(/^\*+/, "").trim())
      .filter(Boolean);

    params.forEach((param) => names.add(param));
  }

  return Array.from(names);
}

function levenshteinDistance(left, right) {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let row = 0; row < rows; row++) {
    matrix[row][0] = row;
  }

  for (let col = 0; col < cols; col++) {
    matrix[0][col] = col;
  }

  for (let row = 1; row < rows; row++) {
    for (let col = 1; col < cols; col++) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

function findClosestNameSuggestion(targetName, code) {
  if (!targetName) {
    return null;
  }

  const candidates = [
    ...new Set([...extractUserDefinedNames(code), ...COMMON_PYTHON_NAMES]),
  ].filter((candidate) => candidate && candidate !== targetName);

  const loweredTarget = targetName.toLowerCase();
  let bestCandidate = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distance = levenshteinDistance(
      loweredTarget,
      candidate.toLowerCase()
    );
    const maxLength = Math.max(candidate.length, targetName.length);
    const threshold = Math.max(1, Math.ceil(maxLength / 3));

    if (distance > threshold) {
      continue;
    }

    if (
      distance < bestDistance ||
      bestCandidate === null ||
      (distance === bestDistance && candidate.length < bestCandidate.length)
    ) {
      bestCandidate = candidate;
      bestDistance = distance;
    }
  }

  return bestCandidate;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePositiveInteger(value) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function extractUndefinedName(errorInfo) {
  if (!errorInfo) {
    return null;
  }

  if (errorInfo.undefinedName) {
    return errorInfo.undefinedName;
  }

  const match = (errorInfo.message || "").match(/name '([^']+)' is not defined/i);
  return match ? match[1] : null;
}

function extractSuggestionFromMessage(message) {
  const match = (message || "").match(/Did you mean:\s*['"]([^'"]+)['"]/i);
  return match ? match[1] : null;
}

function stripInlineSuggestion(message) {
  return (message || "")
    .replace(/\s*Did you mean:\s*['"][^'"]+['"]\??/i, "")
    .trim();
}

function findColumnForName(lineText, targetName) {
  if (!lineText || !targetName) {
    return null;
  }

  const pattern = new RegExp(`\\b${escapeRegExp(targetName)}\\b`);
  const match = pattern.exec(lineText);
  return match ? match.index + 1 : null;
}

function buildSuggestedLine(lineText, originalName, suggestion) {
  if (!lineText || !originalName || !suggestion) {
    return null;
  }

  const pattern = new RegExp(`\\b${escapeRegExp(originalName)}\\b`);
  return pattern.test(lineText) ? lineText.replace(pattern, suggestion) : null;
}

function buildCodeFrame(lineText, lineNumber, columnNumber) {
  if (!lineText) {
    return "";
  }

  const safeLineNumber = lineNumber || "?";
  const prefix = `${safeLineNumber} | `;
  const frameLine = `${prefix}${lineText}`;

  if (!columnNumber) {
    return frameLine;
  }

  const safeColumn = Math.max(1, Math.min(columnNumber, lineText.length + 1));
  return `${frameLine}\n${" ".repeat(prefix.length + safeColumn - 1)}^`;
}

function getFriendlyErrorMessage(errorInfo, undefinedName) {
  const errorType = errorInfo?.type || "PythonError";

  switch (errorType) {
    case "NameError":
      return undefinedName
        ? `"${undefinedName}" nomi topilmadi.`
        : "Aniqlanmagan nom ishlatildi.";
    case "SyntaxError":
      return "Kod sintaksisida xatolik bor.";
    case "IndentationError":
      return "Indentatsiya noto'g'ri. Bo'sh joy va tablarni tekshiring.";
    case "TabError":
      return "Tab va space aralashib ketgan. Editor kodni tekislashga harakat qildi, lekin bu qatorni qo'lda ham tekshiring.";
    case "TypeError":
      return "Mos kelmaydigan qiymat turi ishlatildi.";
    case "ZeroDivisionError":
      return "0 ga bo'lish mumkin emas.";
    case "LoopIterationError":
      return "Kod juda uzoq ishladi. Cheksiz sikl bo'lishi mumkin.";
    default:
      return errorInfo?.message || "Kod bajarishda xatolik yuz berdi.";
  }
}

function buildRepairHints(errorInfo, undefinedName, suggestion, codeLine) {
  const errorType = errorInfo?.type || "PythonError";
  const normalizedLine = (codeLine || "").trim();
  const hints = [];

  switch (errorType) {
    case "NameError":
      if (suggestion && suggestion !== undefinedName) {
        hints.push(`"${undefinedName}" o'rniga "${suggestion}" ni ishlatib ko'ring.`);
      }
      hints.push("Nom yozilishi va kerakli import mavjudligini tekshiring.");
      break;
    case "SyntaxError":
      if (
        /^(if|elif|else|for|while|def|class|try|except|finally|with)\b/.test(
          normalizedLine
        ) &&
        !normalizedLine.endsWith(":")
      ) {
        hints.push("Qator oxiriga ':' qo'shib ko'ring.");
      } else {
        hints.push("Qavs, qo'shtirnoq va ':' belgilarini qayta tekshirib ko'ring.");
      }
      break;
    case "IndentationError":
    case "TabError":
      hints.push("Format tugmasi yoki Ctrl+Shift+F bilan kodni tekislab ko'ring.");
      hints.push(`Tab o'rniga ${INDENT_SIZE} ta space ishlating.`);
      break;
    case "TypeError":
      hints.push("Qiymat turlarini tekshirib, kerak bo'lsa int(), float() yoki str() bilan aylantirib ko'ring.");
      break;
    case "ZeroDivisionError":
      hints.push("Bo'luvchi qiymat 0 emasligini tekshirib ko'ring.");
      break;
    case "LoopIterationError":
      hints.push("Sikl sharti yangilanayotganini yoki kerakli joyda break borligini tekshirib ko'ring.");
      break;
    default:
      break;
  }

  return hints;
}

function getLeadingWhitespace(lineText) {
  return (lineText || "").match(/^[ \t]*/)?.[0] || "";
}

function getIndentationDetails(lineText) {
  const leadingWhitespace = getLeadingWhitespace(lineText);
  const tabs = (leadingWhitespace.match(/\t/g) || []).length;
  const spaces = (leadingWhitespace.match(/ /g) || []).length;

  return {
    leadingWhitespace,
    tabs,
    spaces,
    width: spaces + tabs * INDENT_SIZE,
    visual: leadingWhitespace.replace(/\t/g, "[tab]").replace(/ /g, "."),
  };
}

function findPreviousMeaningfulLine(lines, startIndex) {
  for (let index = startIndex; index >= 0; index -= 1) {
    if ((lines[index] || "").trim()) {
      return {
        lineNumber: index + 1,
        text: lines[index],
      };
    }
  }

  return null;
}

function collectIndentationLevels(lines, beforeIndex) {
  const levels = new Set([0]);

  for (let index = 0; index < beforeIndex; index += 1) {
    if (!(lines[index] || "").trim()) {
      continue;
    }

    levels.add(getIndentationDetails(lines[index]).width);
  }

  return Array.from(levels).sort((left, right) => left - right);
}

function buildIndentationDiagnostics(errorInfo, code) {
  const errorType = errorInfo?.type || "PythonError";
  if (!["IndentationError", "TabError"].includes(errorType)) {
    return { lines: [], suggestedLine: null };
  }

  const lineNumber = normalizePositiveInteger(errorInfo.line);
  const codeLines = String(code || "").replace(/\r\n/g, "\n").split("\n");
  const lineText =
    (lineNumber && codeLines[lineNumber - 1]) || errorInfo.codeLine || "";
  const currentIndent = getIndentationDetails(lineText);
  const previousLine = findPreviousMeaningfulLine(codeLines, (lineNumber || 1) - 2);
  const previousIndent = previousLine
    ? getIndentationDetails(previousLine.text)
    : { width: 0 };
  const message = String(errorInfo.message || "");
  const lines = [];
  let suggestedSpaces = null;

  if (currentIndent.tabs && currentIndent.spaces) {
    lines.push(
      `Bu qatorda boshida ${currentIndent.tabs} ta tab va ${currentIndent.spaces} ta space aralashgan.`
    );
  } else if (currentIndent.tabs) {
    lines.push(
      `Bu qatorda boshida ${currentIndent.tabs} ta tab bor. Python uchun faqat space ishlatish tavsiya qilinadi.`
    );
  } else {
    lines.push(`Bu qatorda boshida ${currentIndent.spaces} ta space bor.`);
  }

  lines.push(
    `Ko'rinadigan indent: ${currentIndent.visual || "(yo'q)"}`
  );

  if (previousLine) {
    lines.push(
      `Oldingi muhim qator: ${previousLine.lineNumber}-qator, indent ${previousIndent.width} ta space.`
    );
  }

  if (/expected an indented block/i.test(message)) {
    suggestedSpaces = previousIndent.width + INDENT_SIZE;
    lines.push(`Kutilgan indent: kamida ${suggestedSpaces} ta space.`);
  } else if (/unexpected indent/i.test(message)) {
    lines.push("Bu qatorda ortiqcha bosh bo'sh joy bor.");
    suggestedSpaces = previousIndent.width;
  } else if (/unindent does not match any outer indentation level/i.test(message)) {
    const validLevels = collectIndentationLevels(codeLines, lineNumber || 0);
    lines.push(`Mos indent darajalari: ${validLevels.join(", ")} ta space.`);
  }

  return {
    lines,
    suggestedLine:
      suggestedSpaces === null || !lineText.trim()
        ? null
        : `${" ".repeat(suggestedSpaces)}${lineText.trimStart()}`,
  };
}

function findBlockingWhitespaceIssue(code) {
  const lines = String(code || "").replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const lineText = lines[index];
    if (!lineText.trim()) {
      continue;
    }

    const details = getIndentationDetails(lineText);
    if (!details.tabs) {
      continue;
    }

    return {
      lineNumber: index + 1,
      columnNumber: 1,
      text: lineText,
      details,
    };
  }

  return null;
}

function buildWhitespaceIssueMessage(issue) {
  const issueType =
    issue.details.spaces > 0 ? "Tab va space aralashgan" : "Tab ishlatilgan";

  return [
    `Xatolik turi: ${issueType}`,
    `Joylashuv: ${issue.lineNumber}-qator, 1-ustun`,
    `Sabab: Python indentatsiyada tab ishlatilsa xato berishi mumkin.`,
    "",
    "Muammo bo'lgan qator:",
    buildCodeFrame(issue.text, issue.lineNumber, 1),
    "",
    "Indentatsiya tahlili:",
    `1. Tablar: ${issue.details.tabs} ta`,
    `2. Spacelar: ${issue.details.spaces} ta`,
    `3. Ko'rinadigan indent: ${issue.details.visual || "(yo'q)"}`,
    "",
    "Sinab ko'ring:",
    `1. Toolbar'dagi Format tugmasini bosing.`,
    `2. Tab o'rniga ${INDENT_SIZE} ta space ishlating.`,
  ].join("\n");
}

function getWordRangeAtColumn(lineText, columnIndex) {
  if (!lineText) {
    return null;
  }

  const isWordCharacter = (char) => /[a-zA-Z0-9_]/.test(char || "");
  const safeIndex = Math.max(
    0,
    Math.min(columnIndex, Math.max(0, lineText.length - 1))
  );
  let start = safeIndex;
  let end = safeIndex;

  if (
    !isWordCharacter(lineText[start]) &&
    start > 0 &&
    isWordCharacter(lineText[start - 1])
  ) {
    start -= 1;
    end -= 1;
  }

  if (!isWordCharacter(lineText[start])) {
    return {
      start: safeIndex,
      end: Math.min(safeIndex + 1, lineText.length),
    };
  }

  while (start > 0 && isWordCharacter(lineText[start - 1])) {
    start -= 1;
  }

  while (end < lineText.length && isWordCharacter(lineText[end])) {
    end += 1;
  }

  return { start, end };
}

function clearEditorDiagnostics() {
  if (!editor) {
    return;
  }

  if (activeErrorLineNumber !== null) {
    editor.removeLineClass(activeErrorLineNumber, "background", "error-line");
    activeErrorLineNumber = null;
  }

  if (activeErrorTextMarker) {
    activeErrorTextMarker.clear();
    activeErrorTextMarker = null;
  }
}

function highlightEditorError(lineNumber, columnNumber, focusToken) {
  clearEditorDiagnostics();

  if (!editor) {
    return;
  }

  const safeLineNumber = normalizePositiveInteger(lineNumber);
  if (!safeLineNumber || safeLineNumber > editor.lineCount()) {
    return;
  }

  const lineIndex = safeLineNumber - 1;
  const lineText = editor.getLine(lineIndex) || "";
  let start = null;
  let end = null;

  activeErrorLineNumber = lineIndex;
  editor.addLineClass(lineIndex, "background", "error-line");

  if (focusToken) {
    const pattern = new RegExp(`\\b${escapeRegExp(focusToken)}\\b`);
    const match = pattern.exec(lineText);
    if (match) {
      start = match.index;
      end = match.index + match[0].length;
    }
  }

  if (start === null) {
    const safeColumn = normalizePositiveInteger(columnNumber);
    if (safeColumn) {
      const wordRange = getWordRangeAtColumn(lineText, safeColumn - 1);
      if (wordRange) {
        start = wordRange.start;
        end = wordRange.end;
      }
    }
  }

  if (start !== null && end !== null && end > start) {
    activeErrorTextMarker = editor.markText(
      { line: lineIndex, ch: start },
      { line: lineIndex, ch: end },
      { className: "error-token" }
    );
  }

  editor.setCursor({ line: lineIndex, ch: start !== null ? start : 0 });
  editor.scrollIntoView(
    { line: lineIndex, ch: start !== null ? start : 0 },
    120
  );
}

function updateEditorStatus() {
  if (!editor) {
    return;
  }

  const cursor = editor.getCursor();
  const lineText = editor.getLine(cursor.line) || "";
  const indentation = getIndentationDetails(lineText);
  const primary = document.getElementById("editor-status-primary");
  const secondary = document.getElementById("editor-status-secondary");

  if (primary) {
    primary.textContent = `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`;
  }

  if (secondary) {
    secondary.textContent =
      indentation.tabs > 0
        ? `Tabs: ${indentation.tabs} | Spaces: ${indentation.spaces}`
        : `Spaces: ${indentation.spaces} | Tab size: ${INDENT_SIZE}`;
  }
}

function applyEditorTypography(fontFamilyKey, fontSize) {
  if (!editor) {
    return;
  }

  const safeFontFamily = EDITOR_FONT_FAMILIES[fontFamilyKey]
    ? fontFamilyKey
    : DEFAULT_EDITOR_FONT_FAMILY;
  const safeFontSize = EDITOR_FONT_SIZES.has(fontSize)
    ? fontSize
    : DEFAULT_EDITOR_FONT_SIZE;
  const root = document.documentElement;
  const wrapper = editor.getWrapperElement();
  const fontFamilySelect = document.getElementById("editor-font-family");
  const fontSizeSelect = document.getElementById("editor-font-size");

  root.style.setProperty(
    "--editor-font-family",
    EDITOR_FONT_FAMILIES[safeFontFamily]
  );
  root.style.setProperty("--editor-font-size", safeFontSize);
  wrapper.style.fontFamily = EDITOR_FONT_FAMILIES[safeFontFamily];
  wrapper.style.fontSize = safeFontSize;

  if (fontFamilySelect) {
    fontFamilySelect.value = safeFontFamily;
  }

  if (fontSizeSelect) {
    fontSizeSelect.value = safeFontSize;
  }

  localStorage.setItem("editorFontFamily", safeFontFamily);
  localStorage.setItem("editorFontSize", safeFontSize);
  editor.refresh();
  updateEditorStatus();
}

function loadEditorTypographyPreferences() {
  const savedFontFamily =
    localStorage.getItem("editorFontFamily") || DEFAULT_EDITOR_FONT_FAMILY;
  const savedFontSize =
    localStorage.getItem("editorFontSize") || DEFAULT_EDITOR_FONT_SIZE;

  applyEditorTypography(savedFontFamily, savedFontSize);
}

function scrollEditorToCursor() {
  if (!editor) {
    return;
  }

  requestAnimationFrame(() => {
    const cursor = editor.getCursor();
    editor.scrollIntoView({ line: cursor.line, ch: cursor.ch }, 90);
  });
}

function scrollOutputToLatest() {
  requestAnimationFrame(() => {
    const output = document.getElementById("output");
    const inputHost = document.getElementById("output-input-host");

    if (output) {
      output.scrollTop = output.scrollHeight;
    }

    if (inputHost && inputHost.classList.contains("active")) {
      inputHost.scrollIntoView({ block: "nearest" });
    }
  });
}

function formatEditorCode() {
  if (!editor) {
    return;
  }

  formatCodeWithAutoFix(editor);
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]
  );
}

function clearOutputInputHost() {
  const inputHost = document.getElementById("output-input-host");
  if (!inputHost) {
    return;
  }

  inputHost.className = "output-input-host";
  inputHost.innerHTML = "";
}

function buildInputWaitingMessage(resultObj, executionTime) {
  const lines = [];

  if (resultObj.output && resultObj.output.trim()) {
    lines.push(resultObj.output.trimEnd());
  }

  lines.push(
    "",
    `Kutilayotgan input: ${(resultObj.error?.prompt || "Qiymat kiriting").trim() || "Qiymat kiriting"}`,
    `Bajarilish vaqti: ${executionTime} soniya`
  );

  return lines.join("\n").trim();
}

function renderOutputPanelInput(promptText, inputIndex) {
  const inputHost = document.getElementById("output-input-host");
  if (!inputHost) {
    return;
  }

  inputHost.className = "output-input-host active";
  inputHost.innerHTML = `
    <div class="output-input-label">${escapeHtml(
      promptText || `Input ${inputIndex + 1}`
    )}</div>
    <div class="output-input-row">
      <input
        type="text"
        class="output-input-field"
        id="output-panel-input"
        autocomplete="off"
        spellcheck="false"
        placeholder="Qiymatni shu yerga kiriting"
      />
      <button type="button" class="output-input-submit" id="output-panel-submit">Yuborish</button>
    </div>
  `;

  const inputElement = document.getElementById("output-panel-input");
  const submitButton = document.getElementById("output-panel-submit");

  const submitInput = () => {
    if (!activeRunSession) {
      clearOutputInputHost();
      return;
    }

    activeRunSession.inputValues.push(inputElement.value);
    clearOutputInputHost();
    continueRunSession(activeRunSession);
  };

  submitButton.addEventListener("click", submitInput);
  inputElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitInput();
    }
  });
  inputElement.addEventListener("input", () => {
    inputElement.scrollLeft = inputElement.scrollWidth;
    scrollOutputToLatest();
  });
  inputElement.focus();
  scrollOutputToLatest();
}

function normalizeCodeForExecution(code) {
  return code
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "    ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");
}

async function prepareCodeForExecution(code) {
  const normalizedCode = normalizeCodeForExecution(code);

  if (!pyodide) {
    return {
      code: normalizedCode,
      changed: normalizedCode !== code,
      formatterUsed: false,
    };
  }

  try {
    const result = await pyodide.runPythonAsync(`
import json
prepared = auto_fix_code(${JSON.stringify(normalizedCode)})
json.dumps(prepared)
    `);
    const prepared = JSON.parse(result);
    const preparedCode = typeof prepared.code === "string" ? prepared.code : normalizedCode;

    return {
      code: preparedCode,
      changed: preparedCode !== code,
      formatterUsed: Boolean(prepared.formatterAvailable),
    };
  } catch (error) {
    console.warn("Kodni avtomatik tozalashda xatolik:", error);
    return {
      code: normalizedCode,
      changed: normalizedCode !== code,
      formatterUsed: false,
    };
  }
}

function buildExecutionErrorReport(resultObj, code, executionTime) {
  const errorInfo = resultObj.error || {};
  const undefinedName = extractUndefinedName(errorInfo);
  const suggestion =
    extractSuggestionFromMessage(errorInfo.message) ||
    findClosestNameSuggestion(undefinedName, code);
  const friendlyMessage = getFriendlyErrorMessage(errorInfo, undefinedName);
  const rawPythonMessage = stripInlineSuggestion(errorInfo.message);
  const lineNumber = normalizePositiveInteger(errorInfo.line);
  let columnNumber = normalizePositiveInteger(errorInfo.column);
  const editorLine =
    lineNumber && editor && lineNumber <= editor.lineCount()
      ? editor.getLine(lineNumber - 1)
      : "";
  const codeLine = (editorLine || errorInfo.codeLine || "").replace(/\r?\n$/, "");
  const repairHints = buildRepairHints(
    errorInfo,
    undefinedName,
    suggestion,
    codeLine
  );
  const indentationDiagnostics = buildIndentationDiagnostics(errorInfo, code);

  if (!columnNumber && undefinedName && codeLine) {
    columnNumber = findColumnForName(codeLine, undefinedName);
  }

  const reportLines = [
    `Xatolik turi: ${errorInfo.type || "PythonError"}`,
    `Sabab: ${friendlyMessage}`,
  ];

  if (rawPythonMessage && rawPythonMessage !== friendlyMessage) {
    reportLines.push(`Python xabari: ${rawPythonMessage}`);
  }

  if (lineNumber) {
    reportLines.push(
      `Joylashuv: ${lineNumber}-qator${columnNumber ? `, ${columnNumber}-ustun` : ""}`
    );
  }

  if (codeLine) {
    reportLines.push(
      "",
      "Muammo bo'lgan qator:",
      buildCodeFrame(codeLine, lineNumber, columnNumber)
    );
  }

  if (indentationDiagnostics.lines.length) {
    reportLines.push("", "Indentatsiya tahlili:");
    indentationDiagnostics.lines.forEach((line, index) => {
      reportLines.push(`${index + 1}. ${line}`);
    });

    if (
      indentationDiagnostics.suggestedLine &&
      indentationDiagnostics.suggestedLine !== codeLine
    ) {
      reportLines.push(
        "Tavsiya etilgan indent:",
        indentationDiagnostics.suggestedLine
      );
    }
  }

  if (suggestion && suggestion !== undefinedName) {
    reportLines.push("", `Taxminiy yechim: "${suggestion}" ni sinab ko'ring.`);

    const suggestedLine = buildSuggestedLine(codeLine, undefinedName, suggestion);
    if (suggestedLine && suggestedLine !== codeLine) {
      reportLines.push("Tavsiya etilgan variant:", suggestedLine);
    }
  }

  if (repairHints.length) {
    reportLines.push("", "Sinab ko'ring:");
    repairHints.forEach((hint, index) => {
      reportLines.push(`${index + 1}. ${hint}`);
    });
  }

  if (resultObj.output && resultObj.output.trim()) {
    reportLines.push("", "Xatolikdan oldingi chiqish:", resultObj.output.trim());
  }

  reportLines.push("", `Bajarilish vaqti: ${executionTime} soniya`);

  return {
    text: reportLines.join("\n"),
    lineNumber,
    columnNumber,
    focusToken: undefinedName || suggestion || null,
  };
}

async function setupSafeExecutionEnvironment() {
  const pyodideVersion = pyodide.version;
  if (!pyodideVersion || parseFloat(pyodideVersion) < 0.23) {
    console.warn(
      "Pyodide versiyasi eski. Ba'zi funksiyalar ishlamasligi mumkin."
    );
  }

  await pyodide.runPythonAsync(`
import sys
import ast
import builtins
import traceback
from io import StringIO
import time

try:
    import autopep8
except Exception:
    autopep8 = None

class LoopIterationError(Exception):
    pass

class AwaitingInput(Exception):
    def __init__(self, prompt="", input_index=0):
        super().__init__(prompt)
        self.prompt = prompt or ""
        self.input_index = input_index

class LoopTransformer(ast.NodeTransformer):
    def visit_For(self, node):
        self.generic_visit(node)
        guard_call = ast.Expr(
            value=ast.Call(
                func=ast.Name(id="_check_execution_time", ctx=ast.Load()),
                args=[],
                keywords=[]
            )
        )
        ast.copy_location(guard_call, node)
        node.body.insert(0, guard_call)
        return node

    def visit_While(self, node):
        self.generic_visit(node)
        guard_call = ast.Expr(
            value=ast.Call(
                func=ast.Name(id="_check_execution_time", ctx=ast.Load()),
                args=[],
                keywords=[]
            )
        )
        ast.copy_location(guard_call, node)
        node.body.insert(0, guard_call)
        return node

def _safe_repr(value, limit=140):
    try:
        rendered = repr(value)
    except Exception:
        rendered = f"<{type(value).__name__}>"

    if len(rendered) > limit:
        rendered = rendered[: limit - 3] + "..."
    return rendered

def _serialize_scope(scope):
    serialized = []

    for name in sorted(scope):
        if str(name).startswith("__") or name == "_check_execution_time":
            continue

        try:
            value = scope[name]
        except Exception:
            continue

        serialized.append(
            {
                "name": str(name),
                "type": type(value).__name__,
                "value": _safe_repr(value),
            }
        )

        if len(serialized) >= 18:
            break

    return serialized

class SafeExecutor:
    def __init__(self, max_execution_time=5):
        self.max_execution_time = max_execution_time
        self.start_time = None

    def compile_code(self, code):
        tree = ast.parse(code, filename="<user_code>", mode="exec")
        transformer = LoopTransformer()
        new_tree = transformer.visit(tree)
        ast.fix_missing_locations(new_tree)
        return compile(new_tree, filename="<user_code>", mode="exec")

    def compile_debug_code(self, code):
        prepared = str(code).replace("\\r\\n", "\\n")
        return compile(prepared, filename="<user_code>", mode="exec")

    def _serialize_error(self, error):
        traceback_summary = traceback.extract_tb(error.__traceback__)
        user_frame = None

        for frame in reversed(traceback_summary):
            if frame.filename == "<user_code>":
                user_frame = frame
                break

        line_number = getattr(error, "lineno", None)
        column_number = getattr(error, "offset", None)
        code_line = getattr(error, "text", None)

        if user_frame is not None:
            if line_number is None:
                line_number = user_frame.lineno
            if not code_line:
                code_line = user_frame.line

        serialized = {
            "type": error.__class__.__name__,
            "message": str(error),
            "line": line_number,
            "column": column_number,
            "codeLine": code_line.strip("\\n") if isinstance(code_line, str) else code_line,
            "undefinedName": getattr(error, "name", None),
            "traceback": "".join(traceback.format_exception(type(error), error, error.__traceback__)),
        }

        if isinstance(error, AwaitingInput):
            serialized["prompt"] = error.prompt
            serialized["inputIndex"] = error.input_index

        return serialized

    def _check_execution_time(self):
        if time.time() - self.start_time > self.max_execution_time:
            raise LoopIterationError("Loop execution time exceeded the limit!")

    def _create_input_handler(self, provided_inputs=None):
        provided_inputs = [
            "" if value is None else str(value)
            for value in (provided_inputs or [])
        ]
        consumed_inputs = 0

        def managed_input(prompt=""):
            nonlocal consumed_inputs
            prompt_text = "" if prompt is None else str(prompt)
            if consumed_inputs >= len(provided_inputs):
                raise AwaitingInput(prompt_text, consumed_inputs)
            value = provided_inputs[consumed_inputs]
            consumed_inputs += 1
            return value

        return managed_input

    def execute(self, code, provided_inputs=None):
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = StringIO()
        sys.stderr = StringIO()
        result = {
            "output": "",
            "success": True,
            "awaitingInput": False,
            "error": None,
        }

        try:
            compiled_code = self.compile_code(code)
            self.start_time = time.time()
            exec_builtins = dict(vars(builtins))
            exec_builtins["input"] = self._create_input_handler(provided_inputs)
            exec_globals = {
                "__builtins__": exec_builtins,
                "__name__": "__main__",
                "_check_execution_time": self._check_execution_time,
            }
            exec(compiled_code, exec_globals)
        except AwaitingInput as error:
            result["success"] = False
            result["awaitingInput"] = True
            result["error"] = self._serialize_error(error)
        except BaseException as error:
            result["success"] = False
            result["error"] = self._serialize_error(error)
        finally:
            stdout_value = sys.stdout.getvalue().rstrip()
            stderr_value = sys.stderr.getvalue().rstrip()
            result["output"] = "\\n".join(
                value for value in [stdout_value, stderr_value] if value
            )
            sys.stdout = old_stdout
            sys.stderr = old_stderr

        return result

    def debug(self, code, provided_inputs=None, breakpoint_lines=None, max_steps=400):
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = StringIO()
        sys.stderr = StringIO()
        result = {
            "output": "",
            "success": True,
            "awaitingInput": False,
            "error": None,
            "steps": [],
            "stepLimitReached": False,
            "breakpointLines": sorted(
                {
                    int(line)
                    for line in (breakpoint_lines or [])
                    if str(line).strip().isdigit() and int(line) > 0
                }
            ),
        }
        source_lines = str(code).replace("\\r\\n", "\\n").split("\\n")
        breakpoint_set = set(result["breakpointLines"])

        def trace_calls(frame, event, arg):
            if frame.f_code.co_filename != "<user_code>":
                return trace_calls

            if time.time() - self.start_time > self.max_execution_time:
                raise LoopIterationError("Loop execution time exceeded the limit!")

            if event == "line":
                line_number = frame.f_lineno
                code_line = (
                    source_lines[line_number - 1]
                    if 0 < line_number <= len(source_lines)
                    else ""
                )
                result["steps"].append(
                    {
                        "line": line_number,
                        "function": frame.f_code.co_name,
                        "codeLine": code_line,
                        "locals": _serialize_scope(frame.f_locals),
                        "isBreakpoint": line_number in breakpoint_set,
                    }
                )

                if len(result["steps"]) >= max_steps:
                    result["stepLimitReached"] = True
                    sys.settrace(None)
                    return None

            return trace_calls

        try:
            compiled_code = self.compile_debug_code(code)
            self.start_time = time.time()
            exec_builtins = dict(vars(builtins))
            exec_builtins["input"] = self._create_input_handler(provided_inputs)
            exec_globals = {
                "__builtins__": exec_builtins,
                "__name__": "__main__",
                "_check_execution_time": self._check_execution_time,
            }
            sys.settrace(trace_calls)
            exec(compiled_code, exec_globals)
        except AwaitingInput as error:
            result["success"] = False
            result["awaitingInput"] = True
            result["error"] = self._serialize_error(error)
        except BaseException as error:
            result["success"] = False
            result["error"] = self._serialize_error(error)
        finally:
            sys.settrace(None)
            stdout_value = sys.stdout.getvalue().rstrip()
            stderr_value = sys.stderr.getvalue().rstrip()
            result["output"] = "\\n".join(
                value for value in [stdout_value, stderr_value] if value
            )
            sys.stdout = old_stdout
            sys.stderr = old_stderr

        return result

_safe_executor = SafeExecutor(max_execution_time=5)

def auto_fix_code(code):
    prepared = str(code).replace("\\r\\n", "\\n").replace("\\t", "    ")
    formatter_available = autopep8 is not None

    if formatter_available:
        try:
            prepared = autopep8.fix_code(prepared)
        except Exception:
            formatter_available = False

    return {
        "code": prepared,
        "formatterAvailable": formatter_available,
    }

def safe_execute(code, provided_inputs=None):
    return _safe_executor.execute(code, provided_inputs)

def debug_execute(code, provided_inputs=None, breakpoint_lines=None, max_steps=400):
    return _safe_executor.debug(code, provided_inputs, breakpoint_lines, max_steps)
  `);
}

function clearOutput() {
  activeRunSession = null;
  activeDebugSession = null;
  clearEditorDiagnostics();
  clearOutputInputHost();
  clearDebugState();
  showOutput('Natija tozalandi. Kodni yozing va "Run" tugmasini bosing.', "");
}

async function runCode() {
  if (!pyodide) {
    showOutput("Python hali yuklanmagan. Iltimos, kuting...", "error");
    return;
  }

  const code = editor.getValue();
  if (!code.trim()) {
    showOutput("Kod kiritilmagan.", "error");
    return;
  }

  const whitespaceIssue = findBlockingWhitespaceIssue(code);
  if (whitespaceIssue) {
    clearDebugState();
    clearEditorDiagnostics();
    highlightEditorError(
      whitespaceIssue.lineNumber,
      whitespaceIssue.columnNumber,
      null
    );
    showOutput(buildWhitespaceIssueMessage(whitespaceIssue), "error");
    return;
  }

  clearDebugState();
  activeRunSession = {
    code,
    inputValues: [],
  };
  showOutput("Bajarilmoqda...", "");
  clearOutputInputHost();
  await continueRunSession(activeRunSession);
}

async function debugCode() {
  if (!pyodide) {
    showOutput("Python hali yuklanmagan. Iltimos, kuting...", "error");
    return;
  }

  const code = editor.getValue();
  if (!code.trim()) {
    showOutput("Kod kiritilmagan.", "error");
    return;
  }

  const whitespaceIssue = findBlockingWhitespaceIssue(code);
  if (whitespaceIssue) {
    clearDebugState();
    clearEditorDiagnostics();
    highlightEditorError(
      whitespaceIssue.lineNumber,
      whitespaceIssue.columnNumber,
      null
    );
    showOutput(buildWhitespaceIssueMessage(whitespaceIssue), "error");
    return;
  }

  clearDebugState();
  activeDebugSession = {
    code,
    inputValues: [],
    breakpoints: getBreakpointLines(),
  };
  showOutput("Debugger ishga tushirilmoqda...", "");
  clearOutputInputHost();
  await continueDebugSession(activeDebugSession);
}

function setupBreakpoints() {
  editor.on("gutterClick", function (cm, line, gutter) {
    if (!["breakpoints", "CodeMirror-linenumbers"].includes(gutter)) {
      return;
    }

    setDebugRangeFromLineClick(line + 1);
  });

  syncDebugRangeMarkers();
  renderDebugRangeState();
}

function openArena() {
  window.open("/zone", "_blank", "noopener,noreferrer");
}

function isStackedPanelLayout() {
  return window.matchMedia("(max-width: 1080px)").matches;
}

function getPanelSplitStorageKey(stacked) {
  return stacked ? "editorPanelSplitMobileRatio" : "editorPanelSplitDesktopRatio";
}

function getPanelSplitDefaultRatio(stacked) {
  return stacked ? 0.54 : 0.56;
}

function getPanelSplitBounds(container, stacked) {
  const availableSpace =
    (stacked ? container.clientHeight : container.clientWidth) -
    (parseFloat(getComputedStyle(container).getPropertyValue("--panel-resizer-size")) ||
      14);
  const minPrimary = stacked ? 240 : 320;
  const minSecondary = stacked ? 220 : 300;

  return {
    availableSpace: Math.max(0, availableSpace),
    minPrimary,
    minSecondary,
  };
}

function getCurrentPanelSplitRatio(container, stacked) {
  const primaryPanel = container.querySelector(".editor-panel");
  const bounds = getPanelSplitBounds(container, stacked);
  const primaryRect = primaryPanel?.getBoundingClientRect();
  const primarySize = stacked ? primaryRect?.height : primaryRect?.width;

  if (!primarySize || !bounds.availableSpace) {
    return getPanelSplitDefaultRatio(stacked);
  }

  return primarySize / bounds.availableSpace;
}

function applyPanelSplitRatio(container, ratio, options = {}) {
  const stacked = isStackedPanelLayout();
  const bounds = getPanelSplitBounds(container, stacked);
  if (!bounds.availableSpace) {
    return;
  }

  const minRatio = bounds.minPrimary / bounds.availableSpace;
  const maxRatio = 1 - bounds.minSecondary / bounds.availableSpace;
  const safeRatio = Math.min(
    Math.max(Number.isFinite(ratio) ? ratio : getPanelSplitDefaultRatio(stacked), minRatio),
    Math.max(minRatio, maxRatio)
  );
  const sizePx = Math.round(bounds.availableSpace * safeRatio);
  const resizer = document.getElementById("panel-resizer");

  container.style.setProperty("--panel-primary-size", `${sizePx}px`);
  if (resizer) {
    resizer.setAttribute("aria-orientation", stacked ? "horizontal" : "vertical");
  }

  if (options.persist !== false) {
    localStorage.setItem(getPanelSplitStorageKey(stacked), safeRatio.toFixed(4));
  }

  requestAnimationFrame(() => {
    if (editor) {
      editor.refresh();
      scrollEditorToCursor();
    }
  });
}

function loadSavedPanelSplitRatio(stacked) {
  const stored = Number.parseFloat(
    localStorage.getItem(getPanelSplitStorageKey(stacked)) || ""
  );
  return Number.isFinite(stored) ? stored : getPanelSplitDefaultRatio(stacked);
}

function setupPanelResizer() {
  const container = document.querySelector(".editor-container");
  const resizer = document.getElementById("panel-resizer");
  const primaryPanel = container?.querySelector(".editor-panel");

  if (!container || !resizer || !primaryPanel) {
    return;
  }

  const applySavedSplit = () => {
    applyPanelSplitRatio(container, loadSavedPanelSplitRatio(isStackedPanelLayout()), {
      persist: false,
    });
  };

  let dragState = null;

  const endResize = () => {
    if (!dragState) {
      return;
    }

    container.classList.remove("is-resizing");
    document.body.classList.remove("panel-resizing", "panel-resizing-horizontal", "panel-resizing-vertical");
    dragState = null;
  };

  const onPointerMove = (event) => {
    if (!dragState) {
      return;
    }

    const delta = dragState.stacked
      ? event.clientY - dragState.startPointer
      : event.clientX - dragState.startPointer;
    const nextSize = dragState.startSize + delta;
    const ratio = nextSize / dragState.availableSpace;
    applyPanelSplitRatio(container, ratio);
  };

  resizer.addEventListener("pointerdown", (event) => {
    const stacked = isStackedPanelLayout();
    const bounds = getPanelSplitBounds(container, stacked);
    const panelRect = primaryPanel.getBoundingClientRect();
    dragState = {
      stacked,
      startPointer: stacked ? event.clientY : event.clientX,
      startSize: stacked ? panelRect.height : panelRect.width,
      availableSpace: bounds.availableSpace,
    };

    container.classList.add("is-resizing");
    document.body.classList.add("panel-resizing");
    document.body.classList.add(
      stacked ? "panel-resizing-vertical" : "panel-resizing-horizontal"
    );
    resizer.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  resizer.addEventListener("pointermove", onPointerMove);
  resizer.addEventListener("pointerup", endResize);
  resizer.addEventListener("pointercancel", endResize);
  resizer.addEventListener("lostpointercapture", endResize);

  resizer.addEventListener("keydown", (event) => {
    const stacked = isStackedPanelLayout();
    const currentRatio = getCurrentPanelSplitRatio(container, stacked);
    const step = event.shiftKey ? 0.08 : 0.04;
    let nextRatio = null;

    if (!stacked && event.key === "ArrowLeft") {
      nextRatio = currentRatio - step;
    } else if (!stacked && event.key === "ArrowRight") {
      nextRatio = currentRatio + step;
    } else if (stacked && event.key === "ArrowUp") {
      nextRatio = currentRatio - step;
    } else if (stacked && event.key === "ArrowDown") {
      nextRatio = currentRatio + step;
    } else if (event.key === "Home") {
      nextRatio = getPanelSplitDefaultRatio(stacked);
    }

    if (nextRatio === null) {
      return;
    }

    event.preventDefault();
    applyPanelSplitRatio(container, nextRatio);
  });

  window.addEventListener("resize", applySavedSplit);
  applySavedSplit();
}

window.addEventListener("DOMContentLoaded", setupPanelResizer);

function setupBreakpoints() {
  editor.on("gutterClick", function (cm, line, gutter) {
    if (!["breakpoints", "CodeMirror-linenumbers"].includes(gutter)) {
      return;
    }

    setDebugRangeFromLineClick(line + 1);
  });

  syncDebugRangeMarkers();
  renderDebugRangeState();
}

function setupBreakpoints() {
  editor.on("gutterClick", function (cm, line, gutter) {
    if (!["breakpoints", "CodeMirror-linenumbers"].includes(gutter)) {
      return;
    }

    setDebugRangeFromLineClick(line + 1);
  });

  syncDebugRangeMarkers();
  renderDebugRangeState();
}

function clearOutput() {
  activeRunSession = null;
  activeDebugSession = null;
  clearEditorDiagnostics();
  clearOutputInputHost();
  clearDebugState();
  showOutput('Natija tozalandi. Kodni yozing va "Run" tugmasini bosing.', "");
}

async function runCode() {
  if (!pyodide) {
    showOutput("Python hali yuklanmagan. Iltimos, kuting...", "error");
    return;
  }

  const code = editor.getValue();
  if (!code.trim()) {
    showOutput("Kod kiritilmagan.", "error");
    return;
  }

  const whitespaceIssue = findBlockingWhitespaceIssue(code);
  if (whitespaceIssue) {
    clearDebugState();
    clearEditorDiagnostics();
    highlightEditorError(
      whitespaceIssue.lineNumber,
      whitespaceIssue.columnNumber,
      null
    );
    showOutput(buildWhitespaceIssueMessage(whitespaceIssue), "error");
    return;
  }

  clearDebugState();
  activeRunSession = {
    code,
    inputValues: [],
  };
  showOutput("Bajarilmoqda...", "");
  clearOutputInputHost();
  await continueRunSession(activeRunSession);
}

async function debugCode() {
  if (!pyodide) {
    showOutput("Python hali yuklanmagan. Iltimos, kuting...", "error");
    return;
  }

  const code = editor.getValue();
  if (!code.trim()) {
    showOutput("Kod kiritilmagan.", "error");
    return;
  }

  const whitespaceIssue = findBlockingWhitespaceIssue(code);
  if (whitespaceIssue) {
    clearDebugState();
    clearEditorDiagnostics();
    highlightEditorError(
      whitespaceIssue.lineNumber,
      whitespaceIssue.columnNumber,
      null
    );
    showOutput(buildWhitespaceIssueMessage(whitespaceIssue), "error");
    return;
  }

  clearDebugState();
  activeDebugSession = {
    code,
    inputValues: [],
    breakpoints: getBreakpointLines(),
  };
  showOutput("Debugger ishga tushirilmoqda...", "");
  clearOutputInputHost();
  await continueDebugSession(activeDebugSession);
}

async function setupSafeExecutionEnvironment() {
  const pyodideVersion = pyodide.version;
  if (!pyodideVersion || parseFloat(pyodideVersion) < 0.23) {
    console.warn(
      "Pyodide versiyasi eski. Ba'zi funksiyalar ishlamasligi mumkin."
    );
  }

  await pyodide.runPythonAsync(`
import sys
import ast
import builtins
import traceback
from io import StringIO
import time

try:
    import autopep8
except Exception:
    autopep8 = None

class LoopIterationError(Exception):
    pass

class AwaitingInput(Exception):
    def __init__(self, prompt="", input_index=0):
        super().__init__(prompt)
        self.prompt = prompt or ""
        self.input_index = input_index

class LoopTransformer(ast.NodeTransformer):
    def visit_For(self, node):
        self.generic_visit(node)
        guard_call = ast.Expr(
            value=ast.Call(
                func=ast.Name(id="_check_execution_time", ctx=ast.Load()),
                args=[],
                keywords=[]
            )
        )
        ast.copy_location(guard_call, node)
        node.body.insert(0, guard_call)
        return node

    def visit_While(self, node):
        self.generic_visit(node)
        guard_call = ast.Expr(
            value=ast.Call(
                func=ast.Name(id="_check_execution_time", ctx=ast.Load()),
                args=[],
                keywords=[]
            )
        )
        ast.copy_location(guard_call, node)
        node.body.insert(0, guard_call)
        return node

def _safe_repr(value, limit=140):
    try:
        rendered = repr(value)
    except Exception:
        rendered = f"<{type(value).__name__}>"

    if len(rendered) > limit:
        rendered = rendered[: limit - 3] + "..."
    return rendered

def _serialize_scope(scope):
    serialized = []

    for name in sorted(scope):
        if str(name).startswith("__") or name == "_check_execution_time":
            continue

        try:
            value = scope[name]
        except Exception:
            continue

        serialized.append(
            {
                "name": str(name),
                "type": type(value).__name__,
                "value": _safe_repr(value),
            }
        )

        if len(serialized) >= 18:
            break

    return serialized

class SafeExecutor:
    def __init__(self, max_execution_time=5):
        self.max_execution_time = max_execution_time
        self.start_time = None

    def compile_code(self, code):
        tree = ast.parse(code, filename="<user_code>", mode="exec")
        transformer = LoopTransformer()
        new_tree = transformer.visit(tree)
        ast.fix_missing_locations(new_tree)
        return compile(new_tree, filename="<user_code>", mode="exec")

    def compile_debug_code(self, code):
        prepared = str(code).replace("\\r\\n", "\\n")
        return compile(prepared, filename="<user_code>", mode="exec")

    def _serialize_error(self, error):
        traceback_summary = traceback.extract_tb(error.__traceback__)
        user_frame = None

        for frame in reversed(traceback_summary):
            if frame.filename == "<user_code>":
                user_frame = frame
                break

        line_number = getattr(error, "lineno", None)
        column_number = getattr(error, "offset", None)
        code_line = getattr(error, "text", None)

        if user_frame is not None:
            if line_number is None:
                line_number = user_frame.lineno
            if not code_line:
                code_line = user_frame.line

        serialized = {
            "type": error.__class__.__name__,
            "message": str(error),
            "line": line_number,
            "column": column_number,
            "codeLine": code_line.strip("\\n") if isinstance(code_line, str) else code_line,
            "undefinedName": getattr(error, "name", None),
            "traceback": "".join(traceback.format_exception(type(error), error, error.__traceback__)),
        }

        if isinstance(error, AwaitingInput):
            serialized["prompt"] = error.prompt
            serialized["inputIndex"] = error.input_index

        return serialized

    def _check_execution_time(self):
        if time.time() - self.start_time > self.max_execution_time:
            raise LoopIterationError("Loop execution time exceeded the limit!")

    def _create_input_handler(self, provided_inputs=None):
        provided_inputs = [
            "" if value is None else str(value)
            for value in (provided_inputs or [])
        ]
        consumed_inputs = 0

        def managed_input(prompt=""):
            nonlocal consumed_inputs
            prompt_text = "" if prompt is None else str(prompt)
            if consumed_inputs >= len(provided_inputs):
                raise AwaitingInput(prompt_text, consumed_inputs)
            value = provided_inputs[consumed_inputs]
            consumed_inputs += 1
            return value

        return managed_input

    def execute(self, code, provided_inputs=None):
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = StringIO()
        sys.stderr = StringIO()
        result = {
            "output": "",
            "success": True,
            "awaitingInput": False,
            "error": None,
        }

        try:
            compiled_code = self.compile_code(code)
            self.start_time = time.time()
            exec_builtins = dict(vars(builtins))
            exec_builtins["input"] = self._create_input_handler(provided_inputs)
            exec_globals = {
                "__builtins__": exec_builtins,
                "__name__": "__main__",
                "_check_execution_time": self._check_execution_time,
            }
            exec(compiled_code, exec_globals)
        except AwaitingInput as error:
            result["success"] = False
            result["awaitingInput"] = True
            result["error"] = self._serialize_error(error)
        except BaseException as error:
            result["success"] = False
            result["error"] = self._serialize_error(error)
        finally:
            stdout_value = sys.stdout.getvalue().rstrip()
            stderr_value = sys.stderr.getvalue().rstrip()
            result["output"] = "\\n".join(
                value for value in [stdout_value, stderr_value] if value
            )
            sys.stdout = old_stdout
            sys.stderr = old_stderr

        return result

    def debug(self, code, provided_inputs=None, breakpoint_lines=None, max_steps=400):
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = StringIO()
        sys.stderr = StringIO()
        result = {
            "output": "",
            "success": True,
            "awaitingInput": False,
            "error": None,
            "steps": [],
            "stepLimitReached": False,
            "breakpointLines": sorted(
                {
                    int(line)
                    for line in (breakpoint_lines or [])
                    if str(line).strip().isdigit() and int(line) > 0
                }
            ),
        }
        source_lines = str(code).replace("\\r\\n", "\\n").split("\\n")
        breakpoint_set = set(result["breakpointLines"])

        def trace_calls(frame, event, arg):
            if frame.f_code.co_filename != "<user_code>":
                return trace_calls

            if time.time() - self.start_time > self.max_execution_time:
                raise LoopIterationError("Loop execution time exceeded the limit!")

            if event == "line":
                line_number = frame.f_lineno
                code_line = (
                    source_lines[line_number - 1]
                    if 0 < line_number <= len(source_lines)
                    else ""
                )
                result["steps"].append(
                    {
                        "line": line_number,
                        "function": frame.f_code.co_name,
                        "codeLine": code_line,
                        "locals": _serialize_scope(frame.f_locals),
                        "isBreakpoint": line_number in breakpoint_set,
                    }
                )

                if len(result["steps"]) >= max_steps:
                    result["stepLimitReached"] = True
                    sys.settrace(None)
                    return None

            return trace_calls

        try:
            compiled_code = self.compile_debug_code(code)
            self.start_time = time.time()
            exec_builtins = dict(vars(builtins))
            exec_builtins["input"] = self._create_input_handler(provided_inputs)
            exec_globals = {
                "__builtins__": exec_builtins,
                "__name__": "__main__",
                "_check_execution_time": self._check_execution_time,
            }
            sys.settrace(trace_calls)
            exec(compiled_code, exec_globals)
        except AwaitingInput as error:
            result["success"] = False
            result["awaitingInput"] = True
            result["error"] = self._serialize_error(error)
        except BaseException as error:
            result["success"] = False
            result["error"] = self._serialize_error(error)
        finally:
            sys.settrace(None)
            stdout_value = sys.stdout.getvalue().rstrip()
            stderr_value = sys.stderr.getvalue().rstrip()
            result["output"] = "\\n".join(
                value for value in [stdout_value, stderr_value] if value
            )
            sys.stdout = old_stdout
            sys.stderr = old_stderr

        return result

_safe_executor = SafeExecutor(max_execution_time=5)

def auto_fix_code(code):
    prepared = str(code).replace("\\r\\n", "\\n").replace("\\t", "    ")
    formatter_available = autopep8 is not None

    if formatter_available:
        try:
            prepared = autopep8.fix_code(prepared)
        except Exception:
            formatter_available = False

    return {
        "code": prepared,
        "formatterAvailable": formatter_available,
    }

def safe_execute(code, provided_inputs=None):
    return _safe_executor.execute(code, provided_inputs)

def debug_execute(code, provided_inputs=None, breakpoint_lines=None, max_steps=400):
    return _safe_executor.debug(code, provided_inputs, breakpoint_lines, max_steps)
  `);
}

function renderOutputPanelInput(promptText, inputIndex) {
  const inputHost = document.getElementById("output-input-host");
  if (!inputHost) {
    return;
  }

  inputHost.className = "output-input-host active";
  inputHost.innerHTML = `
    <div class="output-input-label">${escapeHtml(
      promptText || `Input ${inputIndex + 1}`
    )}</div>
    <div class="output-input-row">
      <input
        type="text"
        class="output-input-field"
        id="output-panel-input"
        autocomplete="off"
        spellcheck="false"
        placeholder="Qiymatni shu yerga kiriting"
      />
      <button type="button" class="output-input-submit" id="output-panel-submit">Yuborish</button>
    </div>
  `;

  const inputElement = document.getElementById("output-panel-input");
  const submitButton = document.getElementById("output-panel-submit");

  const submitInput = () => {
    const pendingSession = activeDebugSession || activeRunSession;
    if (!pendingSession) {
      clearOutputInputHost();
      return;
    }

    pendingSession.inputValues.push(inputElement.value);
    clearOutputInputHost();

    if (activeDebugSession) {
      continueDebugSession(activeDebugSession);
      return;
    }

    continueRunSession(activeRunSession);
  };

  submitButton.addEventListener("click", submitInput);
  inputElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitInput();
    }
  });
  inputElement.addEventListener("input", () => {
    inputElement.scrollLeft = inputElement.scrollWidth;
    scrollOutputToLatest();
  });
  inputElement.focus();
  scrollOutputToLatest();
}

function clearOutput() {
  activeRunSession = null;
  activeDebugSession = null;
  clearEditorDiagnostics();
  clearOutputInputHost();
  clearDebugState();
  showOutput('Natija tozalandi. Kodni yozing va "Run" tugmasini bosing.', "");
}

async function executeCodeSession(code, inputValues) {
  const result = await pyodide.runPythonAsync(`
import json
result = safe_execute(${JSON.stringify(code)}, ${JSON.stringify(inputValues || [])})
json.dumps(result)
  `);

  return JSON.parse(result);
}

async function executeDebugSession(code, inputValues, breakpoints) {
  const result = await pyodide.runPythonAsync(`
import json
result = debug_execute(
    ${JSON.stringify(code)},
    ${JSON.stringify(inputValues || [])},
    ${JSON.stringify(breakpoints || [])},
    ${DEBUG_MAX_STEPS}
)
json.dumps(result)
  `);

  return JSON.parse(result);
}

async function continueRunSession(session) {
  activeRunSession = session;
  activeDebugSession = null;

  try {
    clearEditorDiagnostics();
    clearDebugHighlight();
    const startTime = performance.now();
    const resultObj = await executeCodeSession(session.code, session.inputValues);
    const executionTime = ((performance.now() - startTime) / 1000).toFixed(3);

    if (resultObj.awaitingInput) {
      showOutput(buildInputWaitingMessage(resultObj, executionTime), "");
      renderOutputPanelInput(
        resultObj.error?.prompt || "Qiymat kiriting",
        resultObj.error?.inputIndex ?? session.inputValues.length
      );
      return;
    }

    activeRunSession = null;

    if (!resultObj.success) {
      const errorReport = buildExecutionErrorReport(
        resultObj,
        session.code,
        executionTime
      );
      highlightEditorError(
        errorReport.lineNumber,
        errorReport.columnNumber,
        errorReport.focusToken
      );
      showOutput(errorReport.text, "error");
      return;
    }

    clearEditorDiagnostics();
    if (resultObj.output && resultObj.output.trim()) {
      showOutput(
        `${resultObj.output}\nBajarilish vaqti: ${executionTime} soniya`,
        "success"
      );
      return;
    }

    showOutput(
      `Kod muvaffaqiyatli bajarildi\n\nBajarilish vaqti: ${executionTime} soniya`,
      "success"
    );
  } catch (error) {
    activeRunSession = null;
    showOutput(`Xatolik:\n${error.message}`, "error");
  }
}

async function continueDebugSession(session) {
  activeDebugSession = session;
  activeRunSession = null;

  try {
    clearEditorDiagnostics();
    clearDebugHighlight();
    const startTime = performance.now();
    const resultObj = await executeDebugSession(
      session.code,
      session.inputValues,
      session.breakpoints,
      session.rangeSelection
    );
    const executionTime = ((performance.now() - startTime) / 1000).toFixed(3);

    if (resultObj.awaitingInput) {
      showOutput(
        `Debug rejimi input kutmoqda\n\n${buildInputWaitingMessage(
          resultObj,
          executionTime
        )}`,
        ""
      );
      renderOutputPanelInput(
        resultObj.error?.prompt || "Qiymat kiriting",
        resultObj.error?.inputIndex ?? session.inputValues.length
      );
      return;
    }

    activeDebugSession = null;

    if (!resultObj.success) {
      const errorReport = buildExecutionErrorReport(
        resultObj,
        session.code,
        executionTime
      );
      highlightEditorError(
        errorReport.lineNumber,
        errorReport.columnNumber,
        errorReport.focusToken
      );
      showOutput(
        `${errorReport.text}\n\nDebug qadamlar: ${
          Array.isArray(resultObj.steps) ? resultObj.steps.length : 0
        }`,
        "error"
      );
      renderDebugSession(resultObj, executionTime, "error");
      return;
    }

    clearEditorDiagnostics();
    const lines = [
      "Debug yakunlandi.",
      `Qadamlar: ${Array.isArray(resultObj.steps) ? resultObj.steps.length : 0}`,
      session.breakpoints.length
        ? `Nuqtalar: ${session.breakpoints.join(", ")}`
        : "Nuqtalar: yo'q",
    ];

    if (session.rangeSelection?.startLine && session.rangeSelection?.endLine) {
      lines.push(
        `Range: ${session.rangeSelection.startLine}-qatordan ${session.rangeSelection.endLine}-qatorgacha`
      );
    } else if (session.rangeSelection?.startLine) {
      lines.push(`Range: ${session.rangeSelection.startLine}-qatordan oxirigacha`);
    } else if (session.rangeSelection?.endLine) {
      lines.push(`Range: boshidan ${session.rangeSelection.endLine}-qatorgacha`);
    }

    if (resultObj.stepLimitReached) {
      lines.push(`Iz: faqat birinchi ${DEBUG_MAX_STEPS} qadam saqlandi.`);
    }

    lines.push("");

    if (resultObj.output && resultObj.output.trim()) {
      lines.push("Konsol chiqishi:", resultObj.output.trim(), "");
    } else {
      lines.push("Konsol chiqishi: yo'q", "");
    }

    lines.push(`Bajarilish vaqti: ${executionTime} soniya`);
    showOutput(lines.join("\n"), "success");
    renderDebugSession(resultObj, executionTime, "success");
  } catch (error) {
    activeDebugSession = null;
    showOutput(`Debugger xatoligi:\n${error.message}`, "error");
    clearDebugState();
  }
}

async function setupSafeExecutionEnvironment() {
  const pyodideVersion = pyodide.version;
  if (!pyodideVersion || parseFloat(pyodideVersion) < 0.23) {
    console.warn(
      "Pyodide versiyasi eski. Ba'zi funksiyalar ishlamasligi mumkin."
    );
  }

  await pyodide.runPythonAsync(`
import sys
import ast
import builtins
import traceback
from io import StringIO
import time

try:
    import autopep8
except Exception:
    autopep8 = None

class LoopIterationError(Exception):
    pass

class AwaitingInput(Exception):
    def __init__(self, prompt="", input_index=0):
        super().__init__(prompt)
        self.prompt = prompt or ""
        self.input_index = input_index

class LoopTransformer(ast.NodeTransformer):
    def visit_For(self, node):
        self.generic_visit(node)
        guard_call = ast.Expr(
            value=ast.Call(
                func=ast.Name(id="_check_execution_time", ctx=ast.Load()),
                args=[],
                keywords=[]
            )
        )
        ast.copy_location(guard_call, node)
        node.body.insert(0, guard_call)
        return node

    def visit_While(self, node):
        self.generic_visit(node)
        guard_call = ast.Expr(
            value=ast.Call(
                func=ast.Name(id="_check_execution_time", ctx=ast.Load()),
                args=[],
                keywords=[]
            )
        )
        ast.copy_location(guard_call, node)
        node.body.insert(0, guard_call)
        return node

def _safe_repr(value, limit=140):
    try:
        rendered = repr(value)
    except Exception:
        rendered = f"<{type(value).__name__}>"

    if len(rendered) > limit:
        rendered = rendered[: limit - 3] + "..."
    return rendered

def _serialize_scope(scope):
    serialized = []

    for name in sorted(scope):
        if str(name).startswith("__") or name == "_check_execution_time":
            continue

        try:
            value = scope[name]
        except Exception:
            continue

        serialized.append(
            {
                "name": str(name),
                "type": type(value).__name__,
                "value": _safe_repr(value),
            }
        )

        if len(serialized) >= 18:
            break

    return serialized

class SafeExecutor:
    def __init__(self, max_execution_time=5):
        self.max_execution_time = max_execution_time
        self.start_time = None

    def compile_code(self, code):
        tree = ast.parse(code, filename="<user_code>", mode="exec")
        transformer = LoopTransformer()
        new_tree = transformer.visit(tree)
        ast.fix_missing_locations(new_tree)
        return compile(new_tree, filename="<user_code>", mode="exec")

    def compile_debug_code(self, code):
        prepared = str(code).replace("\\r\\n", "\\n")
        return compile(prepared, filename="<user_code>", mode="exec")

    def _serialize_error(self, error):
        traceback_summary = traceback.extract_tb(error.__traceback__)
        user_frame = None

        for frame in reversed(traceback_summary):
            if frame.filename == "<user_code>":
                user_frame = frame
                break

        line_number = getattr(error, "lineno", None)
        column_number = getattr(error, "offset", None)
        code_line = getattr(error, "text", None)

        if user_frame is not None:
            if line_number is None:
                line_number = user_frame.lineno
            if not code_line:
                code_line = user_frame.line

        serialized = {
            "type": error.__class__.__name__,
            "message": str(error),
            "line": line_number,
            "column": column_number,
            "codeLine": code_line.strip("\\n") if isinstance(code_line, str) else code_line,
            "undefinedName": getattr(error, "name", None),
            "traceback": "".join(traceback.format_exception(type(error), error, error.__traceback__)),
        }

        if isinstance(error, AwaitingInput):
            serialized["prompt"] = error.prompt
            serialized["inputIndex"] = error.input_index

        return serialized

    def _check_execution_time(self):
        if time.time() - self.start_time > self.max_execution_time:
            raise LoopIterationError("Loop execution time exceeded the limit!")

    def _create_input_handler(self, provided_inputs=None):
        provided_inputs = [
            "" if value is None else str(value)
            for value in (provided_inputs or [])
        ]
        consumed_inputs = 0

        def managed_input(prompt=""):
            nonlocal consumed_inputs
            prompt_text = "" if prompt is None else str(prompt)
            if consumed_inputs >= len(provided_inputs):
                raise AwaitingInput(prompt_text, consumed_inputs)
            value = provided_inputs[consumed_inputs]
            consumed_inputs += 1
            return value

        return managed_input

    def execute(self, code, provided_inputs=None):
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = StringIO()
        sys.stderr = StringIO()
        result = {
            "output": "",
            "success": True,
            "awaitingInput": False,
            "error": None,
        }

        try:
            compiled_code = self.compile_code(code)
            self.start_time = time.time()
            exec_builtins = dict(vars(builtins))
            exec_builtins["input"] = self._create_input_handler(provided_inputs)
            exec_globals = {
                "__builtins__": exec_builtins,
                "__name__": "__main__",
                "_check_execution_time": self._check_execution_time,
            }
            exec(compiled_code, exec_globals)
        except AwaitingInput as error:
            result["success"] = False
            result["awaitingInput"] = True
            result["error"] = self._serialize_error(error)
        except BaseException as error:
            result["success"] = False
            result["error"] = self._serialize_error(error)
        finally:
            stdout_value = sys.stdout.getvalue().rstrip()
            stderr_value = sys.stderr.getvalue().rstrip()
            result["output"] = "\\n".join(
                value for value in [stdout_value, stderr_value] if value
            )
            sys.stdout = old_stdout
            sys.stderr = old_stderr

        return result

    def debug(self, code, provided_inputs=None, breakpoint_lines=None, max_steps=400):
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = StringIO()
        sys.stderr = StringIO()
        result = {
            "output": "",
            "success": True,
            "awaitingInput": False,
            "error": None,
            "steps": [],
            "stepLimitReached": False,
            "breakpointLines": sorted(
                {
                    int(line)
                    for line in (breakpoint_lines or [])
                    if str(line).strip().isdigit() and int(line) > 0
                }
            ),
        }
        source_lines = str(code).replace("\\r\\n", "\\n").split("\\n")
        breakpoint_set = set(result["breakpointLines"])

        def trace_calls(frame, event, arg):
            if frame.f_code.co_filename != "<user_code>":
                return trace_calls

            if time.time() - self.start_time > self.max_execution_time:
                raise LoopIterationError("Loop execution time exceeded the limit!")

            if event == "line":
                line_number = frame.f_lineno
                code_line = (
                    source_lines[line_number - 1]
                    if 0 < line_number <= len(source_lines)
                    else ""
                )
                result["steps"].append(
                    {
                        "line": line_number,
                        "function": frame.f_code.co_name,
                        "codeLine": code_line,
                        "locals": _serialize_scope(frame.f_locals),
                        "isBreakpoint": line_number in breakpoint_set,
                    }
                )

                if len(result["steps"]) >= max_steps:
                    result["stepLimitReached"] = True
                    sys.settrace(None)
                    return None

            return trace_calls

        try:
            compiled_code = self.compile_debug_code(code)
            self.start_time = time.time()
            exec_builtins = dict(vars(builtins))
            exec_builtins["input"] = self._create_input_handler(provided_inputs)
            exec_globals = {
                "__builtins__": exec_builtins,
                "__name__": "__main__",
                "_check_execution_time": self._check_execution_time,
            }
            sys.settrace(trace_calls)
            exec(compiled_code, exec_globals)
        except AwaitingInput as error:
            result["success"] = False
            result["awaitingInput"] = True
            result["error"] = self._serialize_error(error)
        except BaseException as error:
            result["success"] = False
            result["error"] = self._serialize_error(error)
        finally:
            sys.settrace(None)
            stdout_value = sys.stdout.getvalue().rstrip()
            stderr_value = sys.stderr.getvalue().rstrip()
            result["output"] = "\\n".join(
                value for value in [stdout_value, stderr_value] if value
            )
            sys.stdout = old_stdout
            sys.stderr = old_stderr

        return result

_safe_executor = SafeExecutor(max_execution_time=5)

def auto_fix_code(code):
    prepared = str(code).replace("\\r\\n", "\\n").replace("\\t", "    ")
    formatter_available = autopep8 is not None

    if formatter_available:
        try:
            prepared = autopep8.fix_code(prepared)
        except Exception:
            formatter_available = False

    return {
        "code": prepared,
        "formatterAvailable": formatter_available,
    }

def safe_execute(code, provided_inputs=None):
    return _safe_executor.execute(code, provided_inputs)

def debug_execute(code, provided_inputs=None, breakpoint_lines=None, max_steps=400):
    return _safe_executor.debug(code, provided_inputs, breakpoint_lines, max_steps)
  `);
}

async function runCode() {
  if (!pyodide) {
    showOutput("Python hali yuklanmagan. Iltimos, kuting...", "error");
    return;
  }

  const code = editor.getValue();
  if (!code.trim()) {
    showOutput("Kod kiritilmagan.", "error");
    return;
  }

  const whitespaceIssue = findBlockingWhitespaceIssue(code);
  if (whitespaceIssue) {
    clearDebugState();
    clearEditorDiagnostics();
    highlightEditorError(
      whitespaceIssue.lineNumber,
      whitespaceIssue.columnNumber,
      null
    );
    showOutput(buildWhitespaceIssueMessage(whitespaceIssue), "error");
    return;
  }

  clearDebugState();
  activeRunSession = {
    code,
    inputValues: [],
  };
  showOutput("Bajarilmoqda...", "");
  clearOutputInputHost();
  await continueRunSession(activeRunSession);
}

async function debugCode() {
  if (!pyodide) {
    showOutput("Python hali yuklanmagan. Iltimos, kuting...", "error");
    return;
  }

  const code = editor.getValue();
  if (!code.trim()) {
    showOutput("Kod kiritilmagan.", "error");
    return;
  }

  const whitespaceIssue = findBlockingWhitespaceIssue(code);
  if (whitespaceIssue) {
    clearDebugState();
    clearEditorDiagnostics();
    highlightEditorError(
      whitespaceIssue.lineNumber,
      whitespaceIssue.columnNumber,
      null
    );
    showOutput(buildWhitespaceIssueMessage(whitespaceIssue), "error");
    return;
  }

  clearDebugState();
  activeDebugSession = {
    code,
    inputValues: [],
    breakpoints: getBreakpointLines(),
  };
  showOutput("Debugger ishga tushirilmoqda...", "");
  clearOutputInputHost();
  await continueDebugSession(activeDebugSession);
}

window.addEventListener("DOMContentLoaded", setupDebugPanelControls);

document.addEventListener("keydown", function (event) {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "Enter") {
    event.preventDefault();
    debugCode();
  }
});

window.addEventListener("DOMContentLoaded", function () {
  const textarea = document.getElementById("code-editor");
  const fontFamilySelect = document.getElementById("editor-font-family");
  const fontSizeSelect = document.getElementById("editor-font-size");
  defaultCode = textarea.value;

  editor = CodeMirror.fromTextArea(textarea, {
    mode: "python",
    theme: "eclipse",
    lineNumbers: true,
    indentUnit: 4,
    indentWithTabs: false,
    lineWrapping: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    styleActiveLine: true,
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter", "breakpoints"],
    extraKeys: {
      "Ctrl-Space": "autocomplete",
      "Ctrl-/": toggleComment,
      "Ctrl-Shift-F": formatCode,
      "Ctrl-D": duplicateLine,
      "Alt-Up": moveLineUp,
      "Alt-Down": moveLineDown,
      "Ctrl-F": showFindReplace,
      "Ctrl-H": showFindReplace,
      "Ctrl-G": goToLine,
      "Ctrl-Shift-K": deleteLine,
      Tab: function (cm) {
        if (cm.state.completionActive) {
          return CodeMirror.Pass;
        }
        if (cm.somethingSelected()) {
          cm.indentSelection("add");
        } else {
          cm.replaceSelection("    ");
        }
      },
      "Shift-Tab": function (cm) {
        cm.indentSelection("subtract");
      },
    },
    hintOptions: {
      completeSingle: false,
      alignWithWord: true,
      closeOnUnfocus: true,
    },
  });

  setupAutoClose();
  setupAutocomplete();
  setupCodeSnippets();
  setupMultipleCursors();
  setupBreakpoints();
  setupEditorUtilityListeners();
  loadAutoSavedCode();
  loadTheme();
  loadEditorTypographyPreferences();
  if (fontFamilySelect) {
    fontFamilySelect.addEventListener("change", (event) => {
      applyEditorTypography(event.target.value, fontSizeSelect?.value);
    });
  }
  if (fontSizeSelect) {
    fontSizeSelect.addEventListener("change", (event) => {
      applyEditorTypography(fontFamilySelect?.value, event.target.value);
    });
  }
  updateEditorStatus();
  startAutoSave();
  initPyodide();
});

// 1. TOGGLE COMMENT (Ctrl+/)
function toggleComment(cm) {
  const from = cm.getCursor("start");
  const to = cm.getCursor("end");
  const lineCount = to.line - from.line + 1;

  let allCommented = true;
  for (let i = from.line; i <= to.line; i++) {
    const line = cm.getLine(i);
    if (!line.trim().startsWith("#")) {
      allCommented = false;
      break;
    }
  }

  cm.operation(() => {
    for (let i = from.line; i <= to.line; i++) {
      const line = cm.getLine(i);
      if (allCommented) {
        cm.replaceRange(
          line.replace(/^\s*#\s?/, ""),
          { line: i, ch: 0 },
          { line: i, ch: line.length }
        );
      } else {
        const indent = line.match(/^\s*/)[0];
        cm.replaceRange(
          indent + "# " + line.trim(),
          { line: i, ch: 0 },
          { line: i, ch: line.length }
        );
      }
    }
  });
}

// 2. CODE FORMATTING (Ctrl+Shift+F)
async function formatCodeWithAutoFix(cm) {
  const code = cm.getValue();
  const prepared = await prepareCodeForExecution(code);

  if (prepared.code !== code) {
    cm.setValue(prepared.code.replace(/\n$/, ""));
  }

  showOutput(
    prepared.changed
      ? "✅ Kod avtomatik tozalandi va formatlandi"
      : "✅ Kod allaqachon tartibli ko'rinishda",
    "success"
  );
  setTimeout(clearOutput, 2000);
}

function formatCode(cm) {
  formatCodeWithAutoFix(cm);
  return;
  const code = cm.getValue();
  const lines = code.split("\n");
  let formatted = [];
  let indentLevel = 0;

  for (let line of lines) {
    const trimmed = line.trim();

    if (
      trimmed.startsWith("elif ") ||
      trimmed.startsWith("else:") ||
      trimmed.startsWith("except") ||
      trimmed.startsWith("finally:")
    ) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    if (trimmed) {
      formatted.push("    ".repeat(indentLevel) + trimmed);
    } else {
      formatted.push("");
    }

    if (trimmed.endsWith(":")) {
      indentLevel++;
    }

    if (
      trimmed.startsWith("return ") ||
      trimmed.startsWith("break") ||
      trimmed.startsWith("continue") ||
      trimmed.startsWith("pass")
    ) {
      indentLevel = Math.max(0, indentLevel - 1);
    }
  }

  cm.setValue(formatted.join("\n"));
  showOutput("✅ Kod formatlandi", "success");
  setTimeout(clearOutput, 2000);
}

// 3. DUPLICATE LINE (Ctrl+D)
function duplicateLine(cm) {
  const cursor = cm.getCursor();
  const line = cm.getLine(cursor.line);
  cm.replaceRange("\n" + line, { line: cursor.line, ch: line.length });
  cm.setCursor({ line: cursor.line + 1, ch: cursor.ch });
}

// 4. MOVE LINE UP (Alt+Up)
function moveLineUp(cm) {
  const cursor = cm.getCursor();
  if (cursor.line === 0) return;

  const line = cm.getLine(cursor.line);
  const prevLine = cm.getLine(cursor.line - 1);

  cm.operation(() => {
    cm.replaceRange(
      line + "\n",
      { line: cursor.line - 1, ch: 0 },
      { line: cursor.line - 1, ch: prevLine.length }
    );
    cm.replaceRange(
      prevLine,
      { line: cursor.line, ch: 0 },
      { line: cursor.line, ch: line.length }
    );
    cm.setCursor({ line: cursor.line - 1, ch: cursor.ch });
  });
}

// 5. MOVE LINE DOWN (Alt+Down)
function moveLineDown(cm) {
  const cursor = cm.getCursor();
  if (cursor.line === cm.lineCount() - 1) return;

  const line = cm.getLine(cursor.line);
  const nextLine = cm.getLine(cursor.line + 1);

  cm.operation(() => {
    cm.replaceRange(
      nextLine,
      { line: cursor.line, ch: 0 },
      { line: cursor.line, ch: line.length }
    );
    cm.replaceRange("\n" + line, {
      line: cursor.line + 1,
      ch: nextLine.length,
    });
    cm.setCursor({ line: cursor.line + 1, ch: cursor.ch });
  });
}

// 6. FIND & REPLACE (Ctrl+F / Ctrl+H)
function showFindReplace(cm) {
  const dialog = document.createElement("div");
  dialog.className = "find-replace-dialog";
  dialog.innerHTML = `
        <div class="find-replace-content">
            <input type="text" id="findInput" placeholder="Qidirish..." />
            <input type="text" id="replaceInput" placeholder="Almashtirish..." />
            <div class="find-replace-buttons">
                <button onclick="findNext()">Keyingi</button>
                <button onclick="findPrev()">Oldingi</button>
                <button onclick="replaceOne()">Almashtir</button>
                <button onclick="replaceAll()">Barchasini</button>
                <button onclick="closeFindReplace()">Yopish</button>
            </div>
        </div>
    `;
  document.body.appendChild(dialog);
  document.getElementById("findInput").focus();
}

window.findNext = function () {
  const searchText = document.getElementById("findInput").value;
  if (!searchText) return;
  editor.execCommand("findNext");
};

window.findPrev = function () {
  editor.execCommand("findPrev");
};

window.replaceOne = function () {
  const replaceText = document.getElementById("replaceInput").value;
  editor.replaceSelection(replaceText);
};

window.replaceAll = function () {
  const searchText = document.getElementById("findInput").value;
  const replaceText = document.getElementById("replaceInput").value;
  const code = editor.getValue();
  editor.setValue(code.replaceAll(searchText, replaceText));
};

window.closeFindReplace = function () {
  const dialog = document.querySelector(".find-replace-dialog");
  if (dialog) dialog.remove();
};

// 7. GO TO LINE (Ctrl+G)
function goToLine(cm) {
  const line = prompt("Qator raqamini kiriting:");
  if (line && !isNaN(line)) {
    const lineNum = parseInt(line) - 1;
    cm.setCursor({ line: lineNum, ch: 0 });
    cm.scrollIntoView({ line: lineNum, ch: 0 }, 100);
  }
}

// 8. DELETE LINE (Ctrl+Shift+K)
function deleteLine(cm) {
  const cursor = cm.getCursor();
  cm.replaceRange(
    "",
    { line: cursor.line, ch: 0 },
    { line: cursor.line + 1, ch: 0 }
  );
}

// 9. CODE SNIPPETS
function setupCodeSnippets() {
  const snippets = {
    for: "for i in range(${1:10}):\n    ${2:pass}",
    while: "while ${1:True}:\n    ${2:pass}",
    if: "if ${1:condition}:\n    ${2:pass}",
    def: "def ${1:function_name}(${2:params}):\n    ${3:pass}",
    class: "class ${1:ClassName}:\n    def __init__(self):\n        ${2:pass}",
    try: "try:\n    ${1:pass}\nexcept ${2:Exception} as e:\n    ${3:pass}",
    with: "with open(${1:filename}) as f:\n    ${2:pass}",
    main: 'if __name__ == "__main__":\n    ${1:pass}',
  };

  editor.on("inputRead", function (cm, change) {
    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const word = line.substring(0, cursor.ch).split(/\s/).pop();

    if (snippets[word] && change.text[0] === " ") {
      const from = { line: cursor.line, ch: cursor.ch - word.length - 1 };
      const to = cursor;
      cm.replaceRange(
        snippets[word].replace(/\$\{\d+:([^}]*)\}/g, "$1"),
        from,
        to
      );
    }
  });
}

// 10. MULTIPLE CURSORS (Ctrl+Click)
function setupMultipleCursors() {
  let cursors = [];

  editor.on("mousedown", function (cm, event) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const pos = cm.coordsChar({ left: event.clientX, top: event.clientY });
      cursors.push(pos);
      cm.setSelection(pos, pos);
    }
  });
}

// 11. BREAKPOINTS
function setupBreakpoints() {
  editor.on("gutterClick", function (cm, line, gutter, event) {
    if (gutter === "breakpoints") {
      const info = cm.lineInfo(line);
      if (info.gutterMarkers && info.gutterMarkers.breakpoints) {
        cm.setGutterMarker(line, "breakpoints", null);
      } else {
        const marker = document.createElement("div");
        marker.innerHTML = "●";
        marker.style.color = "#ff4444";
        marker.style.fontSize = "20px";
        cm.setGutterMarker(line, "breakpoints", marker);
      }
    }
  });
}

// 12. AUTO-INDENT PASTE, BRACKET CHECKING, SELECTION INFO
function setupEditorUtilityListeners() {
  editor.on("beforeChange", function (cm, change) {
    if (change.origin === "paste") {
      const lines = change.text;
      const cursor = change.from;
      const currentIndent = cm.getLine(cursor.line).match(/^\s*/)[0].length;

      const indented = lines.map((line, index) => {
        if (index === 0) {
          return line;
        }
        return " ".repeat(currentIndent) + line;
      });

      change.update(change.from, change.to, indented);
    }
  });

  editor.on("changes", function () {
    updateEditorStatus();
    scrollEditorToCursor();
  });

  editor.on("cursorActivity", function (cm) {
    const cursor = cm.getCursor();
    const token = cm.getTokenAt(cursor);

    if (["(", ")", "[", "]", "{", "}"].includes(token.string)) {
      cm.matchBrackets();
    }

    updateEditorStatus();
    scrollEditorToCursor();
  });

  editor.on("cursorActivity", function (cm) {
    const selection = cm.getSelection();
    if (selection) {
      const lines = selection.split("\n").length;
      const chars = selection.length;
      console.log(`Selected: ${lines} lines, ${chars} chars`);
    }
  });
}

// 13. UNDO/REDO HISTORY VIEWER
function showHistory() {
  const history = editor.getHistory();
  console.log("Undo stack:", history.undone.length);
  console.log("Redo stack:", history.done.length);
}

function setupAutoClose() {
  const pairs = {
    "(": ")",
    "[": "]",
    "{": "}",
    '"': '"',
    "'": "'",
    "`": "`",
  };

  editor.on("keydown", function (cm, event) {
    const char = event.key;
    const cursor = cm.getCursor();
    const nextChar = cm.getRange(cursor, {
      line: cursor.line,
      ch: cursor.ch + 1,
    });

    if (
      Object.values(pairs).includes(char) &&
      nextChar === char &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      cm.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
      return;
    }

    if (pairs[char] && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();

      const selection = cm.getSelection();

      if (selection) {
        cm.replaceSelection(char + selection + pairs[char]);
        cm.setCursor({
          line: cursor.line,
          ch: cursor.ch + selection.length + 1,
        });
      } else {
        if (nextChar === pairs[char] && (char === '"' || char === "'")) {
          cm.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
        } else {
          cm.replaceRange(char + pairs[char], cursor);
          cm.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
        }
      }
    } else if (event.key === "Backspace") {
      const charBefore = cm.getRange(
        { line: cursor.line, ch: cursor.ch - 1 },
        cursor
      );
      const charAfter = cm.getRange(cursor, {
        line: cursor.line,
        ch: cursor.ch + 1,
      });

      if (pairs[charBefore] === charAfter) {
        event.preventDefault();
        cm.replaceRange(
          "",
          { line: cursor.line, ch: cursor.ch - 1 },
          { line: cursor.line, ch: cursor.ch + 1 }
        );
      }
    }
  });
}

function setupAutocomplete() {
  CodeMirror.registerHelper("hint", "pythonComplete", function (editor) {
    const cursor = editor.getCursor();
    const token = editor.getTokenAt(cursor);
    const line = editor.getLine(cursor.line);
    const start = token.start;
    const end = cursor.ch;
    const currentWord = line.slice(start, end);

    let list = [];

    const userNames = extractUserDefinedNames(editor.getValue());

    if (line.slice(Math.max(0, end - 5), end) === "math.") {
      list = MATH_FUNCTIONS.map((f) => f.replace("math.", ""));
    } else if (currentWord) {
      const userMatches = userNames.filter((word) =>
        word.toLowerCase().startsWith(currentWord.toLowerCase())
      );

      const keywordMatches = PYTHON_KEYWORDS.filter((word) =>
        word.toLowerCase().startsWith(currentWord.toLowerCase())
      );

      const mathMatch = "math".startsWith(currentWord.toLowerCase())
        ? ["math"]
        : [];

      list = [...userMatches, ...keywordMatches, ...mathMatch];
    } else {
      list = [...userNames, ...PYTHON_KEYWORDS.slice(0, 15)];
    }

    list = [...new Set(list)];

    return {
      list: list,
      from: CodeMirror.Pos(cursor.line, start),
      to: CodeMirror.Pos(cursor.line, end),
    };
  });

  editor.on("inputRead", function (cm, change) {
    if (change.text[0].match(/[a-zA-Z_]/)) {
      CodeMirror.commands.autocomplete(cm, null, {
        hint: CodeMirror.hint.pythonComplete,
        completeSingle: false,
      });
    }
  });
}

window.addEventListener("beforeunload", function () {
  autoSaveCode();
});

function startAutoSave() {
  autoSaveInterval = setInterval(() => {
    autoSaveCode();
  }, 10000);
}

function autoSaveCode() {
  const code = editor.getValue();

  if (code.trim() !== defaultCode.trim()) {
    const timestamp = new Date().toLocaleString("uz-UZ");

    const autoSaveData = {
      code: code,
      timestamp: timestamp,
      lastSaved: Date.now(),
    };

    localStorage.setItem("pythonAutoSave", JSON.stringify(autoSaveData));
  }
}

function loadAutoSavedCode() {
  const autoSaveData = localStorage.getItem("pythonAutoSave");

  if (autoSaveData) {
    try {
      const data = JSON.parse(autoSaveData);

      if (data.code && data.code.trim()) {
        editor.setValue(data.code);

        const timeSaved = new Date(data.lastSaved).toLocaleString("uz-UZ");
        showOutput(
          `✅ Oxirgi sessiya qayta tiklandi\n📅 Saqlangan vaqt: ${timeSaved}`,
          "success"
        );

        setTimeout(() => {
          clearOutput();
        }, 3000);
      }
    } catch (error) {
      console.error("Avtomatik saqlangan kodni yuklashda xatolik:", error);
    }
  }
}

function toggleTheme() {
  const body = document.body;
  const themeBtn = document.getElementById("themeBtn");

  body.classList.toggle("dark-mode");

  if (body.classList.contains("dark-mode")) {
    themeBtn.textContent = "☀️ Light";
    localStorage.setItem("theme", "dark");
  } else {
    themeBtn.textContent = "🌙 Dark";
    localStorage.setItem("theme", "light");
  }
}

function loadTheme() {
  const savedTheme = localStorage.getItem("theme");
  const themeBtn = document.getElementById("themeBtn");

  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    themeBtn.textContent = "☀️ Light";
  }
}

async function ensurePythonRuntimeTools() {
  try {
    await pyodide.loadPackage("micropip");
    await pyodide.runPythonAsync(`
import micropip

try:
    import autopep8
except Exception:
    await micropip.install("autopep8")
    import autopep8
    `);
    pythonFormatterReady = true;
  } catch (error) {
    pythonFormatterReady = false;
    console.warn("Python formatter vositalari yuklanmadi:", error);
  }
}

async function initPyodide() {
  const loading = document.getElementById("loading");
  loading.classList.add("active");

  try {
    pyodide = await loadPyodide();
    loading.textContent = "⏳ Formatlash vositalari yuklanmoqda...";
    await ensurePythonRuntimeTools();
    loading.textContent = "⏳ Python ishga tayyorlanmoqda...";
    await setupSafeExecutionEnvironment();
    loading.textContent = "✅ Python tayyor!";
    setTimeout(() => {
      loading.classList.remove("active");
    }, 2000);
  } catch (error) {
    loading.textContent = "❌ Xatolik: Python yuklanmadi!";
    loading.style.background = "#fee2e2";
    loading.style.color = "#991b1b";
  }
}

async function setupSafeExecutionEnvironment() {
  const pyodideVersion = pyodide.version;
  if (!pyodideVersion || parseFloat(pyodideVersion) < 0.23) {
    console.warn(
      "Pyodide versiyasi eski. Ba'zi funksiyalar ishlamasligi mumkin."
    );
  }

  await pyodide.runPythonAsync(`
import sys
import ast
import builtins
import traceback
from io import StringIO
import time

class LoopIterationError(Exception):
    pass

class SafeExecutor:
    def __init__(self, max_execution_time=5):
        self.max_execution_time = max_execution_time  # Maximum execution time in seconds
        self.start_time = None

    def compile_code(self, code):
        tree = ast.parse(code, filename="<user_code>", mode="exec")
        transformer = LoopTransformer()
        new_tree = transformer.visit(tree)
        ast.fix_missing_locations(new_tree)
        return compile(new_tree, filename="<user_code>", mode="exec")

    def _serialize_error(self, error):
        traceback_summary = traceback.extract_tb(error.__traceback__)
        user_frame = None

        for frame in reversed(traceback_summary):
            if frame.filename == "<user_code>":
                user_frame = frame
                break

        line_number = getattr(error, "lineno", None)
        column_number = getattr(error, "offset", None)
        code_line = getattr(error, "text", None)

        if user_frame is not None:
            if line_number is None:
                line_number = user_frame.lineno
            if not code_line:
                code_line = user_frame.line

        return {
            "type": error.__class__.__name__,
            "message": str(error),
            "line": line_number,
            "column": column_number,
            "codeLine": code_line.strip("\\n") if isinstance(code_line, str) else code_line,
            "undefinedName": getattr(error, "name", None),
            "traceback": "".join(traceback.format_exception(type(error), error, error.__traceback__)),
        }

    def execute(self, code):
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = StringIO()
        sys.stderr = StringIO()
        result = {"output": "", "success": True, "error": None}

        try:
            compiled_code = self.compile_code(code)
            self.start_time = time.time()

            exec_globals = {
                "__builtins__": builtins,
                "__name__": "__main__",
                "_check_execution_time": self._check_execution_time,
            }

            exec(compiled_code, exec_globals)
        except BaseException as e:
            result["success"] = False
            result["error"] = self._serialize_error(e)
        finally:
            stdout_value = sys.stdout.getvalue().rstrip()
            stderr_value = sys.stderr.getvalue().rstrip()
            result["output"] = "\\n".join(
                value for value in [stdout_value, stderr_value] if value
            )
            sys.stdout = old_stdout
            sys.stderr = old_stderr

        return result

    def _check_execution_time(self):
        if time.time() - self.start_time > self.max_execution_time:
            raise LoopIterationError("⏳ Loop execution time exceeded the limit!")

    def _check_execution_time(self):
        if time.time() - self.start_time > self.max_execution_time:
            raise LoopIterationError("Loop execution time exceeded the limit!")

class LoopTransformer(ast.NodeTransformer):
    def visit_For(self, node):
        self.generic_visit(node)
        guard_call = ast.Expr(
            value=ast.Call(
                func=ast.Name(id='_check_execution_time', ctx=ast.Load()),
                args=[],
                keywords=[]
            )
        )
        ast.copy_location(guard_call, node)
        node.body.insert(0, guard_call)
        return node

    def visit_While(self, node):
        self.generic_visit(node)
        guard_call = ast.Expr(
            value=ast.Call(
                func=ast.Name(id='_check_execution_time', ctx=ast.Load()),
                args=[],
                keywords=[]
            )
        )
        ast.copy_location(guard_call, node)
        node.body.insert(0, guard_call)
        return node

_safe_executor = SafeExecutor(max_execution_time=5)  # Set max execution time to 5 seconds

def safe_execute(code):
    return _safe_executor.execute(code)
  `);
}

async function runCode() {
  if (!pyodide) {
    showOutput("❌ Python hali yuklanmagan. Iltimos, kuting...", "error");
    return;
  }

  const code = editor.getValue();

  if (!code.trim()) {
    showOutput("⚠️ Kod kiritilmagan!", "error");
    return;
  }

  showOutput("⏳ Bajarilmoqda...", "");

  try {
    clearEditorDiagnostics();
    const startTime = performance.now();

    const result = await pyodide.runPythonAsync(`
import json
result = safe_execute(${JSON.stringify(code)})
json.dumps(result)
    `);

    const endTime = performance.now();
    const executionTime = ((endTime - startTime) / 1000).toFixed(3);

    const resultObj = JSON.parse(result);

    if (!resultObj.success) {
      const errorReport = buildExecutionErrorReport(resultObj, code, executionTime);
      highlightEditorError(
        errorReport.lineNumber,
        errorReport.columnNumber,
        errorReport.focusToken
      );
      showOutput(errorReport.text, "error");
      return;
    }

    if (resultObj.success) {
      clearEditorDiagnostics();
      if (resultObj.output && resultObj.output.trim()) {
        showOutput(
          `${resultObj.output}\n⏱ Bajarilish vaqti: ${executionTime} soniya`,
          "success"
        );
      } else {
        showOutput(
          `✅ Kod muvaffaqiyatli bajarildi\n\n⏱ Bajarilish vaqti: ${executionTime} soniya`,
          "success"
        );
      }
    } else {
      showOutput(
        `❌ Kod bajarishda xatolik yuz berdi\n⏱ Bajarilish vaqti: ${executionTime} soniya`,
        "error"
      );
    }
  } catch (error) {
    showOutput(`❌ Xatolik:\n${error.message}`, "error");
  }
}

function clearOutput() {
  clearEditorDiagnostics();
  showOutput('Natija tozalandi. Kodni yozing va "Run" tugmasini bosing.', "");
}

function showOutput(text, type) {
  const output = document.getElementById("output");
  clearOutputInputHost();
  output.textContent = text;
  output.className = type ? "output-content " + type : "output-content";
  scrollOutputToLatest();
}

function saveCode() {
  const code = editor.getValue();
  const savedCodes = JSON.parse(localStorage.getItem("pythonCodes") || "[]");
  const timestamp = new Date().toLocaleString("uz-UZ");

  savedCodes.unshift({
    code: code,
    timestamp: timestamp,
  });

  if (savedCodes.length > 10) {
    savedCodes.pop();
  }

  localStorage.setItem("pythonCodes", JSON.stringify(savedCodes));
  showOutput(`✅ Kod saqlandi (${timestamp})`, "success");

  setTimeout(() => {
    clearOutput();
  }, 2000);
}

function loadCode() {
  const savedCodes = JSON.parse(localStorage.getItem("pythonCodes") || "[]");

  if (savedCodes.length === 0) {
    showOutput("❌ Saqlangan kodlar topilmadi!", "error");
    return;
  }

  editor.setValue(savedCodes[0].code);
  showOutput(`✅ Oxirgi kod yuklandi (${savedCodes[0].timestamp})`, "success");

  setTimeout(() => {
    clearOutput();
  }, 2000);
}

function downloadCode() {
  const code = editor.getValue();
  const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const filename = `python_code_${new Date().getTime()}.py`;

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showOutput(`✅ Kod yuklab olindi: ${filename}`, "success");

  setTimeout(() => {
    clearOutput();
  }, 2000);
}

function uploadFile(event) {
  const file = event.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    const content = e.target.result;
    editor.setValue(content);
    showOutput(`✅ Fayl yuklandi: ${file.name}`, "success");

    setTimeout(() => {
      clearOutput();
    }, 2000);
  };

  reader.onerror = function () {
    showOutput("❌ Faylni o'qishda xatolik yuz berdi!", "error");
  };

  reader.readAsText(file);
  event.target.value = "";
}

function formatCodeWithAutoFix(cm) {
  return (async () => {
    const code = cm.getValue();
    const prepared = await prepareCodeForExecution(code);

    if (prepared.code !== code) {
      cm.setValue(prepared.code.replace(/\n$/, ""));
    }

    showOutput(
      prepared.changed
        ? "Kod avtomatik tozalandi va formatlandi"
        : "Kod allaqachon tartibli ko'rinishda",
      "success"
    );
    setTimeout(clearOutput, 2000);
  })();
}

function setupBreakpoints() {
  editor.on("gutterClick", function (cm, line, gutter) {
    if (gutter !== "breakpoints") {
      return;
    }

    const info = cm.lineInfo(line);
    if (info.gutterMarkers && info.gutterMarkers.breakpoints) {
      cm.setGutterMarker(line, "breakpoints", null);
      return;
    }

    const marker = document.createElement("div");
    marker.textContent = "o";
    marker.style.color = "#ff4444";
    marker.style.fontSize = "20px";
    cm.setGutterMarker(line, "breakpoints", marker);
  });
}

function loadAutoSavedCode() {
  const autoSaveData = localStorage.getItem("pythonAutoSave");

  if (!autoSaveData) {
    return;
  }

  try {
    const data = JSON.parse(autoSaveData);
    if (!data.code || !data.code.trim()) {
      return;
    }

    editor.setValue(data.code);
    const timeSaved = new Date(data.lastSaved).toLocaleString("uz-UZ");
    showOutput(
      `Oxirgi sessiya qayta tiklandi\nSaqlangan vaqt: ${timeSaved}`,
      "success"
    );

    setTimeout(() => {
      clearOutput();
    }, 3000);
  } catch (error) {
    console.error("Avtomatik saqlangan kodni yuklashda xatolik:", error);
  }
}

function toggleTheme() {
  const body = document.body;
  const themeBtn = document.getElementById("themeBtn");
  const label = themeBtn.querySelector(".button-label");

  body.classList.toggle("dark-mode");

  if (body.classList.contains("dark-mode")) {
    label.textContent = "Light";
    editor.setOption("theme", "monokai");
    localStorage.setItem("theme", "dark");
  } else {
    label.textContent = "Dark";
    editor.setOption("theme", "eclipse");
    localStorage.setItem("theme", "light");
  }
}

function loadTheme() {
  const savedTheme = localStorage.getItem("theme");
  const themeBtn = document.getElementById("themeBtn");
  const label = themeBtn.querySelector(".button-label");

  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    label.textContent = "Light";
    editor.setOption("theme", "monokai");
    return;
  }

  label.textContent = "Dark";
  editor.setOption("theme", "eclipse");
}

async function initPyodide() {
  const loading = document.getElementById("loading");
  loading.classList.add("active");

  try {
    pyodide = await loadPyodide();
    loading.textContent = "Formatlash vositalari yuklanmoqda...";
    await ensurePythonRuntimeTools();
    loading.textContent = "Python ishga tayyorlanmoqda...";
    await setupSafeExecutionEnvironment();
    loading.textContent = "Python tayyor.";
    setTimeout(() => {
      loading.classList.remove("active");
    }, 1800);
  } catch (error) {
    loading.textContent = "Xatolik: Python yuklanmadi.";
    loading.style.background = "#fff1f3";
    loading.style.color = "#b9384a";
  }
}

async function setupSafeExecutionEnvironment() {
  const pyodideVersion = pyodide.version;
  if (!pyodideVersion || parseFloat(pyodideVersion) < 0.23) {
    console.warn(
      "Pyodide versiyasi eski. Ba'zi funksiyalar ishlamasligi mumkin."
    );
  }

  await pyodide.runPythonAsync(`
import sys
import ast
import builtins
import traceback
from io import StringIO
import time

try:
    import autopep8
except Exception:
    autopep8 = None

class LoopIterationError(Exception):
    pass

class LoopTransformer(ast.NodeTransformer):
    def visit_For(self, node):
        self.generic_visit(node)
        guard_call = ast.Expr(
            value=ast.Call(
                func=ast.Name(id="_check_execution_time", ctx=ast.Load()),
                args=[],
                keywords=[]
            )
        )
        ast.copy_location(guard_call, node)
        node.body.insert(0, guard_call)
        return node

    def visit_While(self, node):
        self.generic_visit(node)
        guard_call = ast.Expr(
            value=ast.Call(
                func=ast.Name(id="_check_execution_time", ctx=ast.Load()),
                args=[],
                keywords=[]
            )
        )
        ast.copy_location(guard_call, node)
        node.body.insert(0, guard_call)
        return node

class SafeExecutor:
    def __init__(self, max_execution_time=5):
        self.max_execution_time = max_execution_time
        self.start_time = None

    def compile_code(self, code):
        tree = ast.parse(code, filename="<user_code>", mode="exec")
        transformer = LoopTransformer()
        new_tree = transformer.visit(tree)
        ast.fix_missing_locations(new_tree)
        return compile(new_tree, filename="<user_code>", mode="exec")

    def _serialize_error(self, error):
        traceback_summary = traceback.extract_tb(error.__traceback__)
        user_frame = None

        for frame in reversed(traceback_summary):
            if frame.filename == "<user_code>":
                user_frame = frame
                break

        line_number = getattr(error, "lineno", None)
        column_number = getattr(error, "offset", None)
        code_line = getattr(error, "text", None)

        if user_frame is not None:
            if line_number is None:
                line_number = user_frame.lineno
            if not code_line:
                code_line = user_frame.line

        return {
            "type": error.__class__.__name__,
            "message": str(error),
            "line": line_number,
            "column": column_number,
            "codeLine": code_line.strip("\\n") if isinstance(code_line, str) else code_line,
            "undefinedName": getattr(error, "name", None),
            "traceback": "".join(traceback.format_exception(type(error), error, error.__traceback__)),
        }

    def _check_execution_time(self):
        if time.time() - self.start_time > self.max_execution_time:
            raise LoopIterationError("Loop execution time exceeded the limit!")

    def execute(self, code):
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = StringIO()
        sys.stderr = StringIO()
        result = {"output": "", "success": True, "error": None}

        try:
            compiled_code = self.compile_code(code)
            self.start_time = time.time()
            exec_globals = {
                "__builtins__": builtins,
                "__name__": "__main__",
                "_check_execution_time": self._check_execution_time,
            }
            exec(compiled_code, exec_globals)
        except BaseException as error:
            result["success"] = False
            result["error"] = self._serialize_error(error)
        finally:
            stdout_value = sys.stdout.getvalue().rstrip()
            stderr_value = sys.stderr.getvalue().rstrip()
            result["output"] = "\\n".join(
                value for value in [stdout_value, stderr_value] if value
            )
            sys.stdout = old_stdout
            sys.stderr = old_stderr

        return result

_safe_executor = SafeExecutor(max_execution_time=5)

def auto_fix_code(code):
    prepared = str(code).replace("\\r\\n", "\\n").replace("\\t", "    ")
    formatter_available = autopep8 is not None

    if formatter_available:
        try:
            prepared = autopep8.fix_code(prepared)
        except Exception:
            formatter_available = False

    return {
        "code": prepared,
        "formatterAvailable": formatter_available,
    }

def safe_execute(code):
    return _safe_executor.execute(code)
  `);
}

async function runCode() {
  if (!pyodide) {
    showOutput("Python hali yuklanmagan. Iltimos, kuting...", "error");
    return;
  }

  const code = editor.getValue();
  if (!code.trim()) {
    showOutput("Kod kiritilmagan.", "error");
    return;
  }

  showOutput("Bajarilmoqda...", "");

  try {
    clearEditorDiagnostics();
    const startTime = performance.now();
    const result = await pyodide.runPythonAsync(`
import json
result = safe_execute(${JSON.stringify(code)})
json.dumps(result)
    `);

    const executionTime = ((performance.now() - startTime) / 1000).toFixed(3);
    const resultObj = JSON.parse(result);

    if (!resultObj.success) {
      const errorReport = buildExecutionErrorReport(resultObj, code, executionTime);
      highlightEditorError(
        errorReport.lineNumber,
        errorReport.columnNumber,
        errorReport.focusToken
      );
      showOutput(errorReport.text, "error");
      return;
    }

    clearEditorDiagnostics();
    if (resultObj.output && resultObj.output.trim()) {
      showOutput(
        `${resultObj.output}\nBajarilish vaqti: ${executionTime} soniya`,
        "success"
      );
      return;
    }

    showOutput(
      `Kod muvaffaqiyatli bajarildi\n\nBajarilish vaqti: ${executionTime} soniya`,
      "success"
    );
  } catch (error) {
    showOutput(`Xatolik:\n${error.message}`, "error");
  }
}

function showOutput(text, type) {
  const output = document.getElementById("output");
  clearOutputInputHost();
  output.textContent = text;
  output.className = type ? "output-content " + type : "output-content";
  output.scrollTop = 0;
}

function saveCode() {
  const code = editor.getValue();
  const savedCodes = JSON.parse(localStorage.getItem("pythonCodes") || "[]");
  const timestamp = new Date().toLocaleString("uz-UZ");

  savedCodes.unshift({ code, timestamp });
  if (savedCodes.length > 10) {
    savedCodes.pop();
  }

  localStorage.setItem("pythonCodes", JSON.stringify(savedCodes));
  showOutput(`Kod saqlandi (${timestamp})`, "success");
  setTimeout(() => {
    clearOutput();
  }, 2000);
}

function loadCode() {
  const savedCodes = JSON.parse(localStorage.getItem("pythonCodes") || "[]");

  if (savedCodes.length === 0) {
    showOutput("Saqlangan kodlar topilmadi.", "error");
    return;
  }

  editor.setValue(savedCodes[0].code);
  showOutput(`Oxirgi kod yuklandi (${savedCodes[0].timestamp})`, "success");
  setTimeout(() => {
    clearOutput();
  }, 2000);
}

function downloadCode() {
  const code = editor.getValue();
  const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filename = `python_code_${Date.now()}.py`;

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showOutput(`Kod yuklab olindi: ${filename}`, "success");
  setTimeout(() => {
    clearOutput();
  }, 2000);
}

function uploadFile(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = function (loadEvent) {
    editor.setValue(loadEvent.target.result);
    showOutput(`Fayl yuklandi: ${file.name}`, "success");
    setTimeout(() => {
      clearOutput();
    }, 2000);
  };

  reader.onerror = function () {
    showOutput("Faylni o'qishda xatolik yuz berdi.", "error");
  };

  reader.readAsText(file);
  event.target.value = "";
}

function formatCodeWithAutoFix(cm) {
  return (async () => {
    const code = cm.getValue();
    const prepared = await prepareCodeForExecution(code);

    if (prepared.code !== code) {
      cm.setValue(prepared.code.replace(/\n$/, ""));
    }

    updateEditorStatus();
    showOutput(
      prepared.changed
        ? prepared.formatterUsed
          ? "Kod formatlandi va indentatsiya tozalandi."
          : "Tablar va ortiqcha bo'shliqlar tozalandi."
        : "Kod allaqachon tartibli ko'rinishda.",
      "success"
    );
    setTimeout(clearOutput, 2000);
  })();
}

async function runCode() {
  if (!pyodide) {
    showOutput("Python hali yuklanmagan. Iltimos, kuting...", "error");
    return;
  }

  const code = editor.getValue();
  if (!code.trim()) {
    showOutput("Kod kiritilmagan.", "error");
    return;
  }

  const whitespaceIssue = findBlockingWhitespaceIssue(code);
  if (whitespaceIssue) {
    clearEditorDiagnostics();
    highlightEditorError(
      whitespaceIssue.lineNumber,
      whitespaceIssue.columnNumber,
      null
    );
    showOutput(buildWhitespaceIssueMessage(whitespaceIssue), "error");
    return;
  }

  showOutput("Bajarilmoqda...", "");

  try {
    clearEditorDiagnostics();
    const startTime = performance.now();
    const result = await pyodide.runPythonAsync(`
import json
result = safe_execute(${JSON.stringify(code)})
json.dumps(result)
    `);

    const executionTime = ((performance.now() - startTime) / 1000).toFixed(3);
    const resultObj = JSON.parse(result);

    if (!resultObj.success) {
      const errorReport = buildExecutionErrorReport(resultObj, code, executionTime);
      highlightEditorError(
        errorReport.lineNumber,
        errorReport.columnNumber,
        errorReport.focusToken
      );
      showOutput(errorReport.text, "error");
      return;
    }

    clearEditorDiagnostics();
    if (resultObj.output && resultObj.output.trim()) {
      showOutput(
        `${resultObj.output}\nBajarilish vaqti: ${executionTime} soniya`,
        "success"
      );
      return;
    }

    showOutput(
      `Kod muvaffaqiyatli bajarildi\n\nBajarilish vaqti: ${executionTime} soniya`,
      "success"
    );
  } catch (error) {
    showOutput(`Xatolik:\n${error.message}`, "error");
  }
}

function clearOutput() {
  activeRunSession = null;
  clearEditorDiagnostics();
  clearOutputInputHost();
  showOutput('Natija tozalandi. Kodni yozing va "Run" tugmasini bosing.', "");
}

async function executeCodeSession(code, inputValues) {
  const result = await pyodide.runPythonAsync(`
import json
result = safe_execute(${JSON.stringify(code)}, ${JSON.stringify(inputValues || [])})
json.dumps(result)
  `);

  return JSON.parse(result);
}

async function continueRunSession(session) {
  activeRunSession = session;

  try {
    clearEditorDiagnostics();
    const startTime = performance.now();
    const resultObj = await executeCodeSession(session.code, session.inputValues);
    const executionTime = ((performance.now() - startTime) / 1000).toFixed(3);

    if (resultObj.awaitingInput) {
      showOutput(buildInputWaitingMessage(resultObj, executionTime), "");
      renderOutputPanelInput(
        resultObj.error?.prompt || "Qiymat kiriting",
        resultObj.error?.inputIndex ?? session.inputValues.length
      );
      return;
    }

    activeRunSession = null;

    if (!resultObj.success) {
      const errorReport = buildExecutionErrorReport(
        resultObj,
        session.code,
        executionTime
      );
      highlightEditorError(
        errorReport.lineNumber,
        errorReport.columnNumber,
        errorReport.focusToken
      );
      showOutput(errorReport.text, "error");
      return;
    }

    clearEditorDiagnostics();
    if (resultObj.output && resultObj.output.trim()) {
      showOutput(
        `${resultObj.output}\nBajarilish vaqti: ${executionTime} soniya`,
        "success"
      );
      return;
    }

    showOutput(
      `Kod muvaffaqiyatli bajarildi\n\nBajarilish vaqti: ${executionTime} soniya`,
      "success"
    );
  } catch (error) {
    activeRunSession = null;
    showOutput(`Xatolik:\n${error.message}`, "error");
  }
}

async function setupSafeExecutionEnvironment() {
  const pyodideVersion = pyodide.version;
  if (!pyodideVersion || parseFloat(pyodideVersion) < 0.23) {
    console.warn(
      "Pyodide versiyasi eski. Ba'zi funksiyalar ishlamasligi mumkin."
    );
  }

  await pyodide.runPythonAsync(`
import sys
import ast
import builtins
import traceback
from io import StringIO
import time

try:
    import autopep8
except Exception:
    autopep8 = None

class LoopIterationError(Exception):
    pass

class AwaitingInput(Exception):
    def __init__(self, prompt="", input_index=0):
        super().__init__(prompt)
        self.prompt = prompt or ""
        self.input_index = input_index

class LoopTransformer(ast.NodeTransformer):
    def visit_For(self, node):
        self.generic_visit(node)
        guard_call = ast.Expr(
            value=ast.Call(
                func=ast.Name(id="_check_execution_time", ctx=ast.Load()),
                args=[],
                keywords=[]
            )
        )
        ast.copy_location(guard_call, node)
        node.body.insert(0, guard_call)
        return node

    def visit_While(self, node):
        self.generic_visit(node)
        guard_call = ast.Expr(
            value=ast.Call(
                func=ast.Name(id="_check_execution_time", ctx=ast.Load()),
                args=[],
                keywords=[]
            )
        )
        ast.copy_location(guard_call, node)
        node.body.insert(0, guard_call)
        return node

class SafeExecutor:
    def __init__(self, max_execution_time=5):
        self.max_execution_time = max_execution_time
        self.start_time = None

    def compile_code(self, code):
        tree = ast.parse(code, filename="<user_code>", mode="exec")
        transformer = LoopTransformer()
        new_tree = transformer.visit(tree)
        ast.fix_missing_locations(new_tree)
        return compile(new_tree, filename="<user_code>", mode="exec")

    def _serialize_error(self, error):
        traceback_summary = traceback.extract_tb(error.__traceback__)
        user_frame = None

        for frame in reversed(traceback_summary):
            if frame.filename == "<user_code>":
                user_frame = frame
                break

        line_number = getattr(error, "lineno", None)
        column_number = getattr(error, "offset", None)
        code_line = getattr(error, "text", None)

        if user_frame is not None:
            if line_number is None:
                line_number = user_frame.lineno
            if not code_line:
                code_line = user_frame.line

        serialized = {
            "type": error.__class__.__name__,
            "message": str(error),
            "line": line_number,
            "column": column_number,
            "codeLine": code_line.strip("\\n") if isinstance(code_line, str) else code_line,
            "undefinedName": getattr(error, "name", None),
            "traceback": "".join(traceback.format_exception(type(error), error, error.__traceback__)),
        }

        if isinstance(error, AwaitingInput):
            serialized["prompt"] = error.prompt
            serialized["inputIndex"] = error.input_index

        return serialized

    def _check_execution_time(self):
        if time.time() - self.start_time > self.max_execution_time:
            raise LoopIterationError("Loop execution time exceeded the limit!")

    def execute(self, code, provided_inputs=None):
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = StringIO()
        sys.stderr = StringIO()
        result = {
            "output": "",
            "success": True,
            "awaitingInput": False,
            "error": None,
        }
        provided_inputs = ["" if value is None else str(value) for value in (provided_inputs or [])]
        consumed_inputs = 0

        def managed_input(prompt=""):
            nonlocal consumed_inputs
            prompt_text = "" if prompt is None else str(prompt)
            if consumed_inputs >= len(provided_inputs):
                raise AwaitingInput(prompt_text, consumed_inputs)
            value = provided_inputs[consumed_inputs]
            consumed_inputs += 1
            return value

        try:
            compiled_code = self.compile_code(code)
            self.start_time = time.time()
            exec_builtins = dict(vars(builtins))
            exec_builtins["input"] = managed_input
            exec_globals = {
                "__builtins__": exec_builtins,
                "__name__": "__main__",
                "_check_execution_time": self._check_execution_time,
            }
            exec(compiled_code, exec_globals)
        except AwaitingInput as error:
            result["success"] = False
            result["awaitingInput"] = True
            result["error"] = self._serialize_error(error)
        except BaseException as error:
            result["success"] = False
            result["error"] = self._serialize_error(error)
        finally:
            stdout_value = sys.stdout.getvalue().rstrip()
            stderr_value = sys.stderr.getvalue().rstrip()
            result["output"] = "\\n".join(
                value for value in [stdout_value, stderr_value] if value
            )
            sys.stdout = old_stdout
            sys.stderr = old_stderr

        return result

_safe_executor = SafeExecutor(max_execution_time=5)

def auto_fix_code(code):
    prepared = str(code).replace("\\r\\n", "\\n").replace("\\t", "    ")
    formatter_available = autopep8 is not None

    if formatter_available:
        try:
            prepared = autopep8.fix_code(prepared)
        except Exception:
            formatter_available = False

    return {
        "code": prepared,
        "formatterAvailable": formatter_available,
    }

def safe_execute(code, provided_inputs=None):
    return _safe_executor.execute(code, provided_inputs)
  `);
}

async function runCode() {
  if (!pyodide) {
    showOutput("Python hali yuklanmagan. Iltimos, kuting...", "error");
    return;
  }

  const code = editor.getValue();
  if (!code.trim()) {
    showOutput("Kod kiritilmagan.", "error");
    return;
  }

  const whitespaceIssue = findBlockingWhitespaceIssue(code);
  if (whitespaceIssue) {
    clearEditorDiagnostics();
    highlightEditorError(
      whitespaceIssue.lineNumber,
      whitespaceIssue.columnNumber,
      null
    );
    showOutput(buildWhitespaceIssueMessage(whitespaceIssue), "error");
    return;
  }

  activeRunSession = {
    code,
    inputValues: [],
  };
  showOutput("Bajarilmoqda...", "");
  clearOutputInputHost();
  await continueRunSession(activeRunSession);
}

function showOutput(text, type) {
  const output = document.getElementById("output");
  clearOutputInputHost();
  output.textContent = text;
  output.className = type ? "output-content " + type : "output-content";
  scrollOutputToLatest();
}

document.addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    runCode();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    saveCode();
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d") {
    e.preventDefault();
    downloadCode();
  }
});

function clearDebugHighlight() {
  if (!editor) {
    return;
  }

  if (activeDebugLineNumber !== null) {
    editor.removeLineClass(activeDebugLineNumber, "background", "debug-line");
    editor.removeLineClass(
      activeDebugLineNumber,
      "background",
      "debug-line-breakpoint"
    );
    activeDebugLineNumber = null;
  }
}

function highlightDebugLine(lineNumber, isBreakpoint) {
  clearDebugHighlight();

  if (!editor) {
    return;
  }

  const safeLineNumber = normalizePositiveInteger(lineNumber);
  if (!safeLineNumber || safeLineNumber > editor.lineCount()) {
    return;
  }

  const lineIndex = safeLineNumber - 1;
  activeDebugLineNumber = lineIndex;
  editor.addLineClass(
    lineIndex,
    "background",
    isBreakpoint ? "debug-line-breakpoint" : "debug-line"
  );
  editor.scrollIntoView({ line: lineIndex, ch: 0 }, 120);
}

function resetDebugPanelView() {
  const panel = document.getElementById("debug-panel");
  const summary = document.getElementById("debug-summary");
  const counter = document.getElementById("debug-step-counter");
  const location = document.getElementById("debug-step-location");
  const stepLine = document.getElementById("debug-step-line");
  const varsList = document.getElementById("debug-vars-list");
  const prevButton = document.getElementById("debug-prev");
  const nextButton = document.getElementById("debug-next");
  const breakpointButton = document.getElementById("debug-breakpoint");

  if (panel) {
    panel.classList.remove("active");
  }

  if (summary) {
    summary.textContent =
      "Qator raqamlari yoniga bosib start va end nuqtalarni qo'ying.";
  }

  if (counter) {
    counter.textContent = "0 / 0";
  }

  if (location) {
    location.textContent = "Qator tanlanmagan";
  }

  if (stepLine) {
    stepLine.textContent =
      'Debugger qadamlarini ko\'rish uchun "Debug" tugmasini bosing.';
  }

  if (varsList) {
    varsList.innerHTML =
      '<div class="debug-empty">Hali ko\'rsatish uchun qadam yo\'q.</div>';
  }

  [prevButton, nextButton, breakpointButton].forEach((button) => {
    if (button) {
      button.disabled = true;
    }
  });
}

function clearDebugState() {
  activeDebugSession = null;
  activeDebugSteps = [];
  activeDebugStepIndex = 0;
  clearDebugHighlight();
  resetDebugPanelView();
}

function clearDebugRangeHighlights() {
  if (!editor) {
    return;
  }

  debugRangeHighlightedBodyLines.forEach((lineIndex) => {
    editor.removeLineClass(lineIndex, "background", "debug-range-body-line");
  });
  debugRangeHighlightedBodyLines = [];

  if (debugRangeHighlightedStartLine !== null) {
    editor.removeLineClass(
      debugRangeHighlightedStartLine,
      "background",
      "debug-range-start-line"
    );
    debugRangeHighlightedStartLine = null;
  }

  if (debugRangeHighlightedEndLine !== null) {
    editor.removeLineClass(
      debugRangeHighlightedEndLine,
      "background",
      "debug-range-end-line"
    );
    debugRangeHighlightedEndLine = null;
  }
}

function getActiveDebugRangeSelection() {
  const startLine = normalizePositiveInteger(debugRangeStartLine);
  const endLine = normalizePositiveInteger(debugRangeEndLine);

  if (!startLine && !endLine) {
    return null;
  }

  if (startLine && endLine) {
    return {
      startLine: Math.min(startLine, endLine),
      endLine: Math.max(startLine, endLine),
    };
  }

  return {
    startLine: startLine || null,
    endLine: endLine || null,
  };
}

function renderDebugRangeState() {
  const activeRange = getActiveDebugRangeSelection();

  clearDebugRangeHighlights();

  if (
    activeRange?.startLine &&
    activeRange?.endLine &&
    editor
  ) {
    const startLine = Math.min(activeRange.startLine, activeRange.endLine);
    const endLine = Math.max(activeRange.startLine, activeRange.endLine);

    for (let lineIndex = startLine - 1; lineIndex <= endLine - 1; lineIndex += 1) {
      debugRangeHighlightedBodyLines.push(lineIndex);
      editor.addLineClass(lineIndex, "background", "debug-range-body-line");
    }
  }

  if (activeRange?.startLine && editor) {
    debugRangeHighlightedStartLine = activeRange.startLine - 1;
    editor.addLineClass(
      debugRangeHighlightedStartLine,
      "background",
      "debug-range-start-line"
    );
  }

  if (activeRange?.endLine && editor) {
    debugRangeHighlightedEndLine = activeRange.endLine - 1;
    editor.addLineClass(
      debugRangeHighlightedEndLine,
      "background",
      "debug-range-end-line"
    );
  }
}

function clearDebugRangeSelection() {
  debugRangeStartLine = null;
  debugRangeEndLine = null;
  syncDebugRangeMarkers();
  renderDebugRangeState();
}

function createDebugPointMarker(kind) {
  const marker = document.createElement("div");
  marker.className = "debug-point-marker";
  marker.title =
    kind === "start" ? "Debug start nuqtasi" : "Debug end nuqtasi";
  return marker;
}

function syncDebugRangeMarkers() {
  if (!editor) {
    return;
  }

  for (let lineIndex = 0; lineIndex < editor.lineCount(); lineIndex += 1) {
    editor.setGutterMarker(lineIndex, "breakpoints", null);
  }

  if (normalizePositiveInteger(debugRangeStartLine)) {
    editor.setGutterMarker(
      debugRangeStartLine - 1,
      "breakpoints",
      createDebugPointMarker("start")
    );
  }

  if (
    normalizePositiveInteger(debugRangeEndLine) &&
    debugRangeEndLine !== debugRangeStartLine
  ) {
    editor.setGutterMarker(
      debugRangeEndLine - 1,
      "breakpoints",
      createDebugPointMarker("end")
    );
  }
}

function setDebugRangeFromLineClick(lineNumber) {
  const safeLineNumber = normalizePositiveInteger(lineNumber);
  if (!safeLineNumber) {
    return;
  }

  if (!debugRangeStartLine) {
    debugRangeStartLine = safeLineNumber;
    debugRangeEndLine = null;
  } else if (!debugRangeEndLine) {
    if (debugRangeStartLine === safeLineNumber) {
      debugRangeStartLine = null;
    } else {
      debugRangeEndLine = safeLineNumber;
    }
  } else if (
    safeLineNumber === debugRangeStartLine ||
    safeLineNumber === debugRangeEndLine
  ) {
    clearDebugRangeSelection();
    return;
  } else {
    debugRangeStartLine = safeLineNumber;
    debugRangeEndLine = null;
  }

  syncDebugRangeMarkers();
  renderDebugRangeState();
}

function getBreakpointLines() {
  return [
    ...new Set(
      [debugRangeStartLine, debugRangeEndLine]
        .map((lineNumber) => normalizePositiveInteger(lineNumber))
        .filter(Boolean)
    ),
  ].sort((left, right) => left - right);
}

function findNextBreakpointStep(startIndex = 0) {
  for (let index = startIndex; index < activeDebugSteps.length; index += 1) {
    if (activeDebugSteps[index]?.isBreakpoint) {
      return index;
    }
  }

  return -1;
}

function updateDebugNavButtons() {
  const prevButton = document.getElementById("debug-prev");
  const nextButton = document.getElementById("debug-next");
  const breakpointButton = document.getElementById("debug-breakpoint");

  if (prevButton) {
    prevButton.disabled = activeDebugSteps.length <= 1 || activeDebugStepIndex <= 0;
  }

  if (nextButton) {
    nextButton.disabled =
      activeDebugSteps.length <= 1 ||
      activeDebugStepIndex >= activeDebugSteps.length - 1;
  }

  if (breakpointButton) {
    breakpointButton.disabled =
      activeDebugSteps.length === 0 ||
      !activeDebugSteps.some((step) => step?.isBreakpoint);
  }
}

function renderDebugStep(stepIndex) {
  const step = activeDebugSteps[stepIndex];
  if (!step) {
    return;
  }

  const panel = document.getElementById("debug-panel");
  const counter = document.getElementById("debug-step-counter");
  const location = document.getElementById("debug-step-location");
  const stepLine = document.getElementById("debug-step-line");
  const varsList = document.getElementById("debug-vars-list");

  activeDebugStepIndex = stepIndex;

  if (panel) {
    panel.classList.add("active");
  }

  if (counter) {
    counter.textContent = `${stepIndex + 1} / ${activeDebugSteps.length}`;
  }

  if (location) {
    const functionLabel =
      step.function && step.function !== "<module>"
        ? ` | ${step.function}()`
        : "";
    location.textContent = `${step.line}-qator${functionLabel}${
      step.isBreakpoint ? " | nuqta" : ""
    }`;
  }

  if (stepLine) {
    stepLine.textContent = `${step.line} | ${step.codeLine || "(bo'sh qator)"}`;
  }

  if (varsList) {
    if (!Array.isArray(step.locals) || step.locals.length === 0) {
      varsList.innerHTML =
        '<div class="debug-empty">Bu qadamda ko\'rinadigan o\'zgaruvchi yo\'q.</div>';
    } else {
      varsList.innerHTML = step.locals
        .map(
          (item) => `
            <div class="debug-var-item">
              <div class="debug-var-name">${escapeHtml(item.name)} <span class="debug-var-type">(${escapeHtml(item.type)})</span></div>
              <div class="debug-var-value">${escapeHtml(item.value)}</div>
            </div>
          `
        )
        .join("");
    }
  }

  highlightDebugLine(step.line, Boolean(step.isBreakpoint));
  updateDebugNavButtons();
}

function renderDebugSession(resultObj, executionTime, mode) {
  const panel = document.getElementById("debug-panel");
  const summary = document.getElementById("debug-summary");
  const steps = Array.isArray(resultObj?.steps) ? resultObj.steps : [];
  const points = Array.isArray(resultObj?.breakpointLines)
    ? resultObj.breakpointLines
    : [];
  const debugRange = resultObj?.debugRange || getActiveDebugRangeSelection();
  const parts = [
    `${mode === "error" ? "Debug to'xtadi" : "Debug tayyor"}`,
    `${steps.length} ta qadam`,
    points.length ? `nuqtalar: ${points.join(", ")}` : "nuqtalar yo'q",
  ];

  if (debugRange?.startLine && debugRange?.endLine) {
    parts.push(`oralik: ${debugRange.startLine}-${debugRange.endLine}`);
  } else if (debugRange?.startLine) {
    parts.push(`boshlanish: ${debugRange.startLine}`);
  } else if (debugRange?.endLine) {
    parts.push(`tugash: ${debugRange.endLine}`);
  }

  if (resultObj?.stepLimitReached) {
    parts.push(`faqat birinchi ${steps.length} qadam saqlandi`);
  }

  parts.push(`${executionTime} soniya`);

  activeDebugSteps = steps;
  activeDebugStepIndex = 0;

  if (summary) {
    summary.textContent = parts.join(" | ");
  }

  if (!panel || steps.length === 0) {
    resetDebugPanelView();
    return;
  }

  panel.classList.add("active");
  const firstBreakpointIndex = findNextBreakpointStep(0);
  const initialIndex =
    mode === "error"
      ? Math.max(0, steps.length - 1)
      : firstBreakpointIndex >= 0
        ? firstBreakpointIndex
        : 0;
  renderDebugStep(initialIndex);
  scrollOutputToLatest();
}

function jumpToNextBreakpoint() {
  if (!activeDebugSteps.length) {
    return;
  }

  let targetIndex = findNextBreakpointStep(activeDebugStepIndex + 1);
  if (targetIndex < 0) {
    targetIndex = findNextBreakpointStep(0);
  }

  if (targetIndex >= 0) {
    renderDebugStep(targetIndex);
  }
}

function setupDebugPanelControls() {
  const prevButton = document.getElementById("debug-prev");
  const nextButton = document.getElementById("debug-next");
  const breakpointButton = document.getElementById("debug-breakpoint");
  const closeButton = document.getElementById("debug-close");

  if (prevButton) {
    prevButton.addEventListener("click", () => {
      if (activeDebugStepIndex > 0) {
        renderDebugStep(activeDebugStepIndex - 1);
      }
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", () => {
      if (activeDebugStepIndex < activeDebugSteps.length - 1) {
        renderDebugStep(activeDebugStepIndex + 1);
      }
    });
  }

  if (breakpointButton) {
    breakpointButton.addEventListener("click", jumpToNextBreakpoint);
  }

  if (closeButton) {
    closeButton.addEventListener("click", clearDebugState);
  }

  resetDebugPanelView();
  renderDebugRangeState();
}

function buildExactFixes(errorInfo, codeLine, undefinedName, suggestion) {
  const errorType = errorInfo?.type || "PythonError";
  const message = String(errorInfo?.message || "");
  const trimmedLine = String(codeLine || "").trim();
  const exactFixes = [];

  if (errorType === "NameError") {
    if (suggestion && suggestion !== undefinedName) {
      const suggestedLine = buildSuggestedLine(codeLine, undefinedName, suggestion);
      if (suggestedLine && suggestedLine !== codeLine) {
        exactFixes.push(`Shu qatorni quyidagicha yozing: ${suggestedLine}`);
      } else {
        exactFixes.push(`"${undefinedName}" o'rniga "${suggestion}" nomini ishlating.`);
      }
    } else if (undefinedName) {
      exactFixes.push(
        `"${undefinedName}" ni ishlatishdan oldin yuqorida qiymat bering yoki kerakli moduldan import qiling.`
      );
    }
  }

  if (errorType === "SyntaxError") {
    if (/expected ':'/i.test(message) && trimmedLine) {
      exactFixes.push(`Qator oxiriga ':' qo'shing: ${trimmedLine}:`);
    } else if (/was never closed/i.test(message)) {
      exactFixes.push("Ochilgan qavs yoki qo'shtirnoqni shu qatorda yoping.");
    } else if (/invalid syntax/i.test(message)) {
      exactFixes.push(
        "Muammo bo'lgan qatordagi qavs, vergul va operatorlarni bitta-bitta tekshiring."
      );
    }
  }

  if (errorType === "IndentationError" || errorType === "TabError") {
    exactFixes.push(
      "Muammo bo'lgan qator boshidagi bo'sh joyni tozalab, qayta 4 ta space bilan yozing."
    );
  }

  if (errorType === "TypeError") {
    if (/unsupported operand type\(s\).*'function'/i.test(message)) {
      exactFixes.push(
        "Funksiya nomini emas, uning natijasini ishlating. Masalan: `my_func()` ko'rinishida chaqiring."
      );
    } else if (
      /(?:'str'.*'int'|'int'.*'str'|'float'.*'str'|'str'.*'float')/i.test(
        message
      )
    ) {
      exactFixes.push(
        "Amaldan oldin qiymatlarni bir xil turga o'tkazing: `int(...)`, `float(...)` yoki `str(...)`."
      );
    }
  }

  return [...new Set(exactFixes)];
}

function buildExecutionErrorReport(resultObj, code, executionTime) {
  const errorInfo = resultObj.error || {};
  const undefinedName = extractUndefinedName(errorInfo);
  const suggestion =
    extractSuggestionFromMessage(errorInfo.message) ||
    findClosestNameSuggestion(undefinedName, code);
  const friendlyMessage = getFriendlyErrorMessage(errorInfo, undefinedName);
  const rawPythonMessage = stripInlineSuggestion(errorInfo.message);
  const lineNumber = normalizePositiveInteger(errorInfo.line);
  let columnNumber = normalizePositiveInteger(errorInfo.column);
  const editorLine =
    lineNumber && editor && lineNumber <= editor.lineCount()
      ? editor.getLine(lineNumber - 1)
      : "";
  const codeLine = (editorLine || errorInfo.codeLine || "").replace(/\r?\n$/, "");
  const repairHints = buildRepairHints(
    errorInfo,
    undefinedName,
    suggestion,
    codeLine
  );
  const exactFixes = buildExactFixes(
    errorInfo,
    codeLine,
    undefinedName,
    suggestion
  );
  const indentationDiagnostics = buildIndentationDiagnostics(errorInfo, code);

  if (!columnNumber && undefinedName && codeLine) {
    columnNumber = findColumnForName(codeLine, undefinedName);
  }

  const reportLines = [
    `Xatolik turi: ${errorInfo.type || "PythonError"}`,
    `Sabab: ${friendlyMessage}`,
  ];

  if (rawPythonMessage && rawPythonMessage !== friendlyMessage) {
    reportLines.push(`Python xabari: ${rawPythonMessage}`);
  }

  if (lineNumber) {
    reportLines.push(
      `Joylashuv: ${lineNumber}-qator${columnNumber ? `, ${columnNumber}-ustun` : ""}`
    );
  }

  if (codeLine) {
    reportLines.push(
      "",
      "Muammo bo'lgan qator:",
      buildCodeFrame(codeLine, lineNumber, columnNumber)
    );
  }

  if (indentationDiagnostics.lines.length) {
    reportLines.push("", "Indentatsiya tahlili:");
    indentationDiagnostics.lines.forEach((line, index) => {
      reportLines.push(`${index + 1}. ${line}`);
    });

    if (
      indentationDiagnostics.suggestedLine &&
      indentationDiagnostics.suggestedLine !== codeLine
    ) {
      reportLines.push(
        "Tavsiya etilgan indent:",
        indentationDiagnostics.suggestedLine
      );
    }
  }

  if (exactFixes.length) {
    reportLines.push("", "Aniq tuzatish:");
    exactFixes.forEach((fix, index) => {
      reportLines.push(`${index + 1}. ${fix}`);
    });
  }

  if (suggestion && suggestion !== undefinedName) {
    reportLines.push("", `Taxminiy yechim: "${suggestion}" ni sinab ko'ring.`);

    const suggestedLine = buildSuggestedLine(codeLine, undefinedName, suggestion);
    if (suggestedLine && suggestedLine !== codeLine) {
      reportLines.push("Tavsiya etilgan variant:", suggestedLine);
    }
  }

  if (repairHints.length) {
    reportLines.push("", "Sinab ko'ring:");
    repairHints.forEach((hint, index) => {
      reportLines.push(`${index + 1}. ${hint}`);
    });
  }

  if (resultObj.output && resultObj.output.trim()) {
    reportLines.push("", "Xatolikdan oldingi chiqish:", resultObj.output.trim());
  }

  reportLines.push("", `Bajarilish vaqti: ${executionTime} soniya`);

  return {
    text: reportLines.join("\n"),
    lineNumber,
    columnNumber,
    focusToken: undefinedName || suggestion || null,
  };
}

async function ensureDebugExecutionEnvironment() {
  if (!pyodide) {
    return;
  }

  await pyodide.runPythonAsync(`
import sys
import builtins
import traceback
from io import StringIO
import time

try:
    AwaitingInput
except NameError:
    class AwaitingInput(Exception):
        def __init__(self, prompt="", input_index=0):
            super().__init__(prompt)
            self.prompt = prompt or ""
            self.input_index = input_index

try:
    LoopIterationError
except NameError:
    class LoopIterationError(Exception):
        pass

def _debug_safe_repr(value, limit=140):
    try:
        rendered = repr(value)
    except Exception:
        rendered = f"<{type(value).__name__}>"
    if len(rendered) > limit:
        rendered = rendered[: limit - 3] + "..."
    return rendered

def _debug_serialize_scope(scope):
    serialized = []
    for name in sorted(scope):
        if str(name).startswith("__"):
            continue
        try:
            value = scope[name]
        except Exception:
            continue
        serialized.append(
            {
                "name": str(name),
                "type": type(value).__name__,
                "value": _debug_safe_repr(value),
            }
        )
        if len(serialized) >= 18:
            break
    return serialized

def debug_execute(
    code,
    provided_inputs=None,
    breakpoint_lines=None,
    max_steps=400,
    start_line=None,
    end_line=None,
):
    old_stdout = sys.stdout
    old_stderr = sys.stderr
    sys.stdout = StringIO()
    sys.stderr = StringIO()
    normalized_start = int(start_line) if str(start_line).strip().isdigit() and int(start_line) > 0 else None
    normalized_end = int(end_line) if str(end_line).strip().isdigit() and int(end_line) > 0 else None
    if normalized_start is not None and normalized_end is not None and normalized_start > normalized_end:
        normalized_start, normalized_end = normalized_end, normalized_start
    result = {
        "output": "",
        "success": True,
        "awaitingInput": False,
        "error": None,
        "steps": [],
        "stepLimitReached": False,
        "debugRange": {
            "startLine": normalized_start,
            "endLine": normalized_end,
        },
        "breakpointLines": sorted(
            {
                int(line)
                for line in (breakpoint_lines or [])
                if str(line).strip().isdigit() and int(line) > 0
            }
        ),
    }
    source_lines = str(code).replace("\\r\\n", "\\n").split("\\n")
    breakpoint_set = set(result["breakpointLines"])
    provided_inputs = ["" if value is None else str(value) for value in (provided_inputs or [])]
    consumed_inputs = 0
    start_time = time.time()

    def managed_input(prompt=""):
        nonlocal consumed_inputs
        prompt_text = "" if prompt is None else str(prompt)
        if consumed_inputs >= len(provided_inputs):
            raise AwaitingInput(prompt_text, consumed_inputs)
        value = provided_inputs[consumed_inputs]
        consumed_inputs += 1
        return value

    def serialize_error(error):
        traceback_summary = traceback.extract_tb(error.__traceback__)
        user_frame = None

        for frame in reversed(traceback_summary):
            if frame.filename == "<user_code>":
                user_frame = frame
                break

        line_number = getattr(error, "lineno", None)
        column_number = getattr(error, "offset", None)
        code_line = getattr(error, "text", None)

        if user_frame is not None:
            if line_number is None:
                line_number = user_frame.lineno
            if not code_line:
                code_line = user_frame.line

        serialized = {
            "type": error.__class__.__name__,
            "message": str(error),
            "line": line_number,
            "column": column_number,
            "codeLine": code_line.strip("\\n") if isinstance(code_line, str) else code_line,
            "undefinedName": getattr(error, "name", None),
            "traceback": "".join(traceback.format_exception(type(error), error, error.__traceback__)),
        }

        if isinstance(error, AwaitingInput):
            serialized["prompt"] = error.prompt
            serialized["inputIndex"] = error.input_index

        return serialized

    def trace_calls(frame, event, arg):
        if frame.f_code.co_filename != "<user_code>":
            return trace_calls

        if time.time() - start_time > 5:
            raise LoopIterationError("Loop execution time exceeded the limit!")

        if event == "line":
            line_number = frame.f_lineno
            code_line = (
                source_lines[line_number - 1]
                if 0 < line_number <= len(source_lines)
                else ""
            )
            if normalized_start is not None and line_number < normalized_start:
                return trace_calls
            if normalized_end is not None and line_number > normalized_end:
                return trace_calls
            result["steps"].append(
                {
                    "line": line_number,
                    "function": frame.f_code.co_name,
                    "codeLine": code_line,
                    "locals": _debug_serialize_scope(frame.f_locals),
                    "isBreakpoint": line_number in breakpoint_set,
                }
            )
            if len(result["steps"]) >= max_steps:
                result["stepLimitReached"] = True
                sys.settrace(None)
                return None

        return trace_calls

    try:
        compiled_code = compile(str(code).replace("\\r\\n", "\\n"), "<user_code>", "exec")
        exec_builtins = dict(vars(builtins))
        exec_builtins["input"] = managed_input
        exec_globals = {
            "__builtins__": exec_builtins,
            "__name__": "__main__",
        }
        sys.settrace(trace_calls)
        exec(compiled_code, exec_globals)
    except AwaitingInput as error:
        result["success"] = False
        result["awaitingInput"] = True
        result["error"] = serialize_error(error)
    except BaseException as error:
        result["success"] = False
        result["error"] = serialize_error(error)
    finally:
        sys.settrace(None)
        stdout_value = sys.stdout.getvalue().rstrip()
        stderr_value = sys.stderr.getvalue().rstrip()
        result["output"] = "\\n".join(
            value for value in [stdout_value, stderr_value] if value
        )
        sys.stdout = old_stdout
        sys.stderr = old_stderr

    return result
  `);
}

async function executeDebugSession(code, inputValues, breakpoints, rangeSelection) {
  await ensureDebugExecutionEnvironment();
  const startLineLiteral = normalizePositiveInteger(rangeSelection?.startLine)
    ? String(rangeSelection.startLine)
    : "None";
  const endLineLiteral = normalizePositiveInteger(rangeSelection?.endLine)
    ? String(rangeSelection.endLine)
    : "None";
  const result = await pyodide.runPythonAsync(`
import json
result = debug_execute(
    ${JSON.stringify(code)},
    ${JSON.stringify(inputValues || [])},
    ${JSON.stringify(breakpoints || [])},
    ${DEBUG_MAX_STEPS},
    ${startLineLiteral},
    ${endLineLiteral}
)
json.dumps(result)
  `);

  return JSON.parse(result);
}

function clearOutput() {
  activeRunSession = null;
  activeDebugSession = null;
  clearEditorDiagnostics();
  clearOutputInputHost();
  clearDebugState();
  showOutput('Natija tozalandi. Kodni yozing va "Run" tugmasini bosing.', "");
}

async function runCode() {
  if (!pyodide) {
    showOutput("Python hali yuklanmagan. Iltimos, kuting...", "error");
    return;
  }

  const code = editor.getValue();
  if (!code.trim()) {
    showOutput("Kod kiritilmagan.", "error");
    return;
  }

  const whitespaceIssue = findBlockingWhitespaceIssue(code);
  if (whitespaceIssue) {
    clearDebugState();
    clearEditorDiagnostics();
    highlightEditorError(
      whitespaceIssue.lineNumber,
      whitespaceIssue.columnNumber,
      null
    );
    showOutput(buildWhitespaceIssueMessage(whitespaceIssue), "error");
    return;
  }

  clearDebugState();
  activeRunSession = {
    code,
    inputValues: [],
  };
  showOutput("Bajarilmoqda...", "");
  clearOutputInputHost();
  await continueRunSession(activeRunSession);
}

async function debugCode() {
  if (!pyodide) {
    showOutput("Python hali yuklanmagan. Iltimos, kuting...", "error");
    return;
  }

  const code = editor.getValue();
  if (!code.trim()) {
    showOutput("Kod kiritilmagan.", "error");
    return;
  }

  const whitespaceIssue = findBlockingWhitespaceIssue(code);
  if (whitespaceIssue) {
    clearDebugState();
    clearEditorDiagnostics();
    highlightEditorError(
      whitespaceIssue.lineNumber,
      whitespaceIssue.columnNumber,
      null
    );
    showOutput(buildWhitespaceIssueMessage(whitespaceIssue), "error");
    return;
  }

  clearDebugState();
  activeDebugSession = {
    code,
    inputValues: [],
    breakpoints: getBreakpointLines(),
    rangeSelection: getActiveDebugRangeSelection(),
  };
  showOutput("Debugger ishga tushirilmoqda...", "");
  clearOutputInputHost();
  await continueDebugSession(activeDebugSession);
}

function setupBreakpoints() {
  editor.on("gutterClick", function (cm, line, gutter) {
    if (!["breakpoints", "CodeMirror-linenumbers"].includes(gutter)) {
      return;
    }

    setDebugRangeFromLineClick(line + 1);
  });

  syncDebugRangeMarkers();
  renderDebugRangeState();
}
