import { useState } from "react";
import TestCasePanel from "../results/TestCasePanel.jsx";
import ResultPanel from "../results/ResultPanel.jsx";

type VisibleTestcase = {
  name?: string;
  input?: string;
  expected_output?: string;
};

type Result = {
  tone: string;
  chip: string;
  summary: string;
  details?: any[];
};

type Props = {
  cases: VisibleTestcase[];
  activeIndex: number;
  onSelect: (index: number) => void;
  result: Result;
  busy: boolean;
};

export default function TestTabs({ cases, activeIndex, onSelect, result, busy }: Props) {
  // Simple tab state: keep everything in one component for now.
  const tabs: Array<"cases" | "result" | "console"> = ["cases", "result", "console"];
  const [active, setActive] = useState<"cases" | "result" | "console">("cases");

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-900 text-gray-200">
      <div className="flex shrink-0 border-b border-gray-800 px-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(tab)}
            className={[
              "relative -mb-px mr-4 border-b-2 px-1 py-2 text-xs font-semibold uppercase tracking-[0.12em]",
              active === tab
                ? "border-indigo-400 text-gray-100"
                : "border-transparent text-gray-400 hover:text-gray-200",
            ].join(" ")}
          >
            {tab === "cases" ? "Test Cases" : tab === "result" ? "Result" : "Console"}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {active === "cases" ? (
          <TestCasePanel cases={cases} activeIndex={activeIndex} onSelect={onSelect} />
        ) : null}
        {active === "result" ? <ResultPanel result={result} busy={busy} /> : null}
        {active === "console" ? (
          <div className="flex h-full flex-col px-4 py-3 text-sm text-gray-300">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
              Console
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-950 p-3 text-xs text-gray-300">
              {result.summary || "No output yet."}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

