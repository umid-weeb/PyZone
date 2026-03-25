export default function SubmitButton({ busy, onClick }) {
  return (
    <button
      className="rounded-[18px] bg-[linear-gradient(135deg,#5b84ff,#7fa0ff)] px-5 py-[14px] font-bold text-white transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
      disabled={busy}
      type="button"
      onClick={onClick}
    >
      {busy ? "Submitting..." : "Submit"}
    </button>
  );
}
