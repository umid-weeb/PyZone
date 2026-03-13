let monacoEditor = null;
const DEFAULT_CODE = `class Solution:\n    def solve(self):\n        pass\n`;

export async function initEditor(hostElement) {
  await loadMonaco();
  monacoEditor = window.monaco.editor.create(hostElement, {
    value: DEFAULT_CODE,
    language: "python",
    theme: "vs-dark",
    fontSize: 14,
    minimap: { enabled: false },
    automaticLayout: true,
    wordWrap: "on",
  });
}

export function setCode(value) {
  if (monacoEditor) monacoEditor.setValue(value || DEFAULT_CODE);
}

export function getCode() {
  return monacoEditor ? monacoEditor.getValue() : DEFAULT_CODE;
}

async function loadMonaco() {
  if (window.monaco?.editor) return;
  if (!window.require) throw new Error("Monaco loader missing");
  const baseUrl = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/";
  window.MonacoEnvironment = {
    getWorkerUrl() {
      const workerSource = `
        self.MonacoEnvironment = { baseUrl: '${baseUrl}' };
        importScripts('${baseUrl}vs/base/worker/workerMain.js');`;
      return `data:text/javascript;charset=utf-8,${encodeURIComponent(workerSource)}`;
    },
  };
  await new Promise((resolve, reject) => {
    window.require.config({ paths: { vs: `${baseUrl}vs` } });
    window.require(["vs/editor/editor.main"], resolve, reject);
  });
}
