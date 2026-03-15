import Editor from "@monaco-editor/react";
import SubmitButton from "./SubmitButton.jsx";

const languageMap = {
  python: "python",
  javascript: "javascript",
  cpp: "cpp",
};

export default function CodeEditorPanel({
  code,
  language,
  isRunning,
  isSubmitting,
  hiddenTestCount = 0,
  onChange,
  onLanguageChange,
  onRun,
  onSubmit,
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-arena-border px-[22px] py-5">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded-2xl border border-arena-border bg-white/5 px-[14px] py-3 text-arena-text outline-none transition focus:border-arena-borderStrong"
            value={language}
            onChange={(event) => onLanguageChange(event.target.value)}
          >
            <option value="python">Python 3.11</option>
            <option value="javascript">JavaScript</option>
            <option value="cpp">C++17</option>
          </select>
          <span className="rounded-[14px] bg-[rgba(108,146,255,0.12)] px-[14px] py-2.5 text-arena-primaryStrong">
            Function
          </span>
          <span className="rounded-[14px] bg-white/5 px-[14px] py-2.5 text-arena-muted">
            {hiddenTestCount > 0 ? `${hiddenTestCount} yashirin` : "Yashirin testlar yo'q"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded-[18px] border border-[rgba(87,223,180,0.2)] bg-[rgba(87,223,180,0.12)] px-5 py-[14px] font-bold text-arena-text transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
            disabled={isRunning}
            type="button"
            onClick={onRun}
          >
            {isRunning ? "Running..." : "Run"}
          </button>
          <SubmitButton busy={isSubmitting} onClick={onSubmit} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-b-[28px]">
        <Editor
          height="100%"
          theme="vs-dark"
          language={languageMap[language] || "python"}
          value={code}
          onChange={(value) => onChange(value || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            automaticLayout: true,
            wordWrap: "on",
            padding: { top: 18 },
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
}
