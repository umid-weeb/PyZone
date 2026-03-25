"use client";
import { useProblemStore } from '@/store/useProblemStore';

export default function AIHintModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { aiHint, isHintLoading } = useProblemStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-200">
      <div className="bg-[#0f1117] border border-indigo-500/30 w-full max-w-lg rounded-2xl shadow-2xl scale-100 p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          ✕
        </button>
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          ✨ AI Hint
        </h3>
        <div className="text-gray-300 leading-relaxed font-sans">
          {isHintLoading ? (
            <div className="flex space-x-2 items-center text-indigo-400">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-75"></div>
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
              <span className="ml-2 text-sm">AI o'ylamoqda...</span>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{aiHint}</p>
          )}
        </div>
        <div className="mt-6 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition"
          >
            Tushunarli
          </button>
        </div>
      </div>
    </div>
  );
}