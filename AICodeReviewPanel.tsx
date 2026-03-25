"use client";
import { useProblemStore } from './useProblemStore';

export default function AICodeReviewPanel() {
  const { aiReview, isReviewLoading } = useProblemStore();

  if (isReviewLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 text-sm animate-pulse">🤖 AI kodingizni analiz qilmoqda...</p>
      </div>
    );
  }

  if (!aiReview) return null;

  return (
    <div className="bg-[#0f1117] border border-indigo-500/20 rounded-xl overflow-hidden font-sans">
      {/* Header & Score */}
      <div className="bg-indigo-500/10 p-5 border-b border-indigo-500/20 flex justify-between items-center">
        <h3 className="text-lg font-bold text-indigo-300 flex items-center gap-2">
          🤖 AI Code Review
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 font-medium">Overall Score:</span>
          <div className="text-2xl font-black text-indigo-400">
            {aiReview.overall_score}/10
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Complexity Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
            <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">⏱ Time Complexity</div>
            <div className="flex items-center gap-2 mb-2 font-mono">
              <span className="text-red-400">{aiReview.time_complexity.detected}</span>
              <span className="text-gray-500">→</span>
              <span className="text-green-400">{aiReview.time_complexity.optimal}</span>
            </div>
            <p className="text-sm text-gray-300">{aiReview.time_complexity.suggestion}</p>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
            <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">💾 Space Complexity</div>
            <div className="font-mono text-indigo-300 mb-2">{aiReview.space_complexity.detected}</div>
            <p className="text-sm text-gray-300">{aiReview.space_complexity.suggestion}</p>
          </div>
        </div>

        {/* Edge Cases & Code Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-lg">
            <div className="text-xs text-red-400/80 uppercase font-bold tracking-wider mb-3">⚠️ Missed Edge Cases</div>
            <ul className="space-y-2 text-sm text-gray-300 list-disc list-inside pl-4">
              {aiReview.edge_cases.map((caseStr, idx) => (
                <li key={idx}>{caseStr}</li>
              ))}
            </ul>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-lg">
            <div className="text-xs text-blue-400/80 uppercase font-bold tracking-wider mb-3">✨ Code Style Tips</div>
            <ul className="space-y-2 text-sm text-gray-300 list-disc list-inside pl-4">
              {aiReview.code_style.map((style, idx) => (
                <li key={idx}>{style}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Alternative Approach */}
        {aiReview.alternative && (
          <div className="bg-green-500/5 border border-green-500/10 p-4 rounded-lg mt-4">
            <div className="text-xs text-green-400/80 uppercase font-bold tracking-wider mb-2">💡 Alternative Approach</div>
            <p className="text-sm text-gray-300 leading-relaxed">{aiReview.alternative}</p>
          </div>
        )}
      </div>
    </div>
  );
}