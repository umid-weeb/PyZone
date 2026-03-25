import { useNavigate } from "react-router-dom";

export default function AuthPromptModal({ open, problemId, onClose }) {
  const navigate = useNavigate();

  if (!open) return null;

  const next = problemId ? `/zone?problem=${encodeURIComponent(problemId)}&pending=submit` : "/zone?pending=submit";

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-[rgba(1,5,12,0.62)] p-5 backdrop-blur-[10px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-[480px] rounded-[26px] border border-arena-border bg-[rgba(10,18,34,0.96)] p-7 shadow-arena"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          className="absolute right-3.5 top-3.5 grid h-9 w-9 place-items-center rounded-full border border-arena-border bg-white/5 text-arena-text transition hover:border-arena-borderStrong hover:bg-white/10"
          type="button"
          onClick={onClose}
        >
          x
        </button>
        <div className="mb-2.5 text-xs uppercase tracking-[0.08em] text-arena-primaryStrong">Auth required</div>
        <h2 className="m-0 text-[1.9rem] font-semibold tracking-[-0.04em]">Sign in to submit</h2>
        <p className="mt-2.5 leading-7 text-arena-muted">
          Create an account or log in to send your solution to the judge and keep your progress.
        </p>
        <div className="mt-[22px] flex gap-3 max-sm:flex-col">
          <button
            type="button"
            className="flex-1 rounded-2xl border border-arena-border bg-white/5 px-4 py-[14px] font-semibold text-arena-text transition hover:border-arena-borderStrong hover:bg-white/10"
            onClick={() => navigate(`/login?next=${encodeURIComponent(next)}`)}
          >
            Login
          </button>
          <button
            type="button"
            className="flex-1 rounded-2xl bg-[linear-gradient(135deg,#5b84ff,#7fa0ff)] px-4 py-[14px] font-semibold text-white transition hover:brightness-110"
            onClick={() => navigate(`/register?next=${encodeURIComponent(next)}`)}
          >
            Create account
          </button>
        </div>
      </div>
    </div>
  );
}
