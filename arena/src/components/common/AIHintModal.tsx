type AIHintModalProps = {
  isOpen: boolean;
  onClose: () => void;
  hint?: string | null;
  isLoading?: boolean;
};

export default function AIHintModal({
  isOpen,
  onClose,
  hint = null,
  isLoading = false,
}: AIHintModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-2xl border border-indigo-500/30 bg-[#0f1117] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 transition hover:text-white"
          aria-label="Close AI hint modal"
        >
          x
        </button>

        <h3 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
          <span aria-hidden="true">AI Hint</span>
        </h3>

        <div className="font-sans leading-relaxed text-gray-300">
          {isLoading ? (
            <div className="flex items-center gap-2 text-indigo-400">
              <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-500" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-500 [animation-delay:75ms]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-500 [animation-delay:150ms]" />
              <span className="ml-2 text-sm">AI o'ylamoqda...</span>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{hint || "Hozircha hint mavjud emas."}</p>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-500"
          >
            Tushunarli
          </button>
        </div>
      </div>
    </div>
  );
}
