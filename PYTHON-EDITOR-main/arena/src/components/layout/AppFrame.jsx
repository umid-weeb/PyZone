import Navbar from "./Navbar.tsx";

export default function AppFrame({ children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[image:var(--arena-bg)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(108,146,255,0.2),transparent_22%),radial-gradient(circle_at_85%_14%,rgba(87,223,180,0.16),transparent_18%)] blur-[10px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_72%,rgba(255,123,143,0.11),transparent_15%),radial-gradient(circle_at_24%_80%,rgba(255,204,102,0.09),transparent_14%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[length:64px_64px] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.35),transparent_75%)]" />
      <Navbar />
      <div className="relative z-10 pt-16">{children}</div>
    </div>
  );
}
