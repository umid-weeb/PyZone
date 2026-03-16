import { Group as ResizablePanelGroup, Panel } from "react-resizable-panels";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { readStoredUsername } from "../../lib/storage.js";
import UserMenu from "../UserMenu.tsx";
import UserQuickSearch from "../common/UserQuickSearch.jsx";
import ResizeHandle from "./ResizeHandle.jsx";

function Surface({ children }) {
  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden rounded-[28px] border border-arena-border bg-arena-surface shadow-arena backdrop-blur-[10px]">
      {children}
    </div>
  );
}

export default function ArenaLayout({
  sidebar,
  viewer,
  editor,
  testCases,
  result,
  authModal,
}) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const storedUsername = readStoredUsername();

  return (
    <div className="mx-auto flex h-screen w-[min(1500px,calc(100vw-20px))] max-w-full flex-col py-[10px] max-[860px]:w-[min(100vw-12px,100%)]">
      <div className="mb-2 flex h-[72px] shrink-0 items-center justify-between gap-3 px-1 max-[860px]:h-auto max-[860px]:flex-col max-[860px]:items-stretch overflow-visible">
        <div className="flex items-center gap-4">
          <button
            className="group inline-flex items-center gap-2 rounded-full border border-arena-border/80 bg-[rgba(8,16,30,0.62)] px-4 py-2.5 text-sm font-medium text-arena-text"
            type="button"
            onClick={() => navigate("/")}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4 text-arena-muted transition group-hover:-translate-x-0.5 group-hover:text-arena-text"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
            <span>Editor</span>
          </button>
          <div>
            <div className="text-[clamp(2rem,3vw,2.4rem)] font-bold tracking-[-0.06em]">Zone</div>
            <div className="mt-0.5 text-sm text-arena-muted">Competitive coding workspace</div>
          </div>
        </div>
        <div className="flex items-center gap-3 max-[860px]:w-full max-[860px]:flex-wrap max-[860px]:justify-between">
          <UserQuickSearch />
          <UserMenu
            user={user}
            onProfile={() => navigate(`/profile/${storedUsername}`)}
            onSubmissions={() =>
              storedUsername ? navigate(`/profile/${encodeURIComponent(storedUsername)}/submissions`) : navigate("/submissions")
            }
            onSettings={() => navigate("/profile/settings")}
            onLogin={() => navigate("/login")}
            onRegister={() => navigate("/register")}
            onLogout={async () => {
              await logout();
              navigate("/login");
            }}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ResizablePanelGroup id="arena-root-panels" orientation="horizontal" className="h-full min-h-0">
          <Panel defaultSize="21%" maxSize="30%" minSize="16%">
            <Surface>{sidebar}</Surface>
          </Panel>
          <ResizeHandle orientation="vertical" />
          <Panel defaultSize="31%" minSize="22%">
            <Surface>{viewer}</Surface>
          </Panel>
          <ResizeHandle orientation="vertical" />
          <Panel defaultSize="48%" minSize="30%">
            <ResizablePanelGroup id="arena-right-column" orientation="vertical" className="h-full min-h-0">
              <Panel defaultSize="63%" minSize="38%">
                <Surface>{editor}</Surface>
              </Panel>
              <ResizeHandle orientation="horizontal" />
              <Panel defaultSize="37%" minSize="22%">
                <ResizablePanelGroup id="arena-bottom-row" orientation="horizontal" className="h-full min-h-0">
                  <Panel defaultSize="48%" minSize="24%">
                    <Surface>{testCases}</Surface>
                  </Panel>
                  <ResizeHandle orientation="vertical" />
                  <Panel defaultSize="52%" minSize="24%">
                    <Surface>{result}</Surface>
                  </Panel>
                </ResizablePanelGroup>
              </Panel>
            </ResizablePanelGroup>
          </Panel>
        </ResizablePanelGroup>
      </div>

      {authModal}
    </div>
  );
}
