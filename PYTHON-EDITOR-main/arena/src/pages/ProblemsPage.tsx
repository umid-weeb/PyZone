import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardShell from "../components/layout/DashboardShell.jsx";
import { API_BASE_URL } from "../lib/apiClient.js";
import { readStoredToken } from "../lib/storage.js";

// Topic categories for filtering (NeetCode style)
const TOPIC_CATEGORIES = [
  "Arrays & Hashing",
  "Two Pointers",
  "Sliding Window",
  "Stack",
  "Binary Search",
  "Linked List",
  "Trees",
  "Tries",
  "Heap / Priority Queue",
  "Backtracking",
  "Graphs",
  "Dynamic Programming",
  "Greedy",
  "Intervals",
  "Math & Geometry",
  "Bit Manipulation",
  "Recursion",
  "Sorting",
];

type Problem = {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  acceptance_rate?: number;
  tags?: string[];
  is_solved?: boolean;
  is_attempted?: boolean;
};

type PaginatedResponse = {
  items: Problem[];
  total: number;
  page: number;
  per_page: number;
  available_tags?: string[];
};

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const d = difficulty?.toLowerCase() || "";
  let colorClass = "bg-slate-500/20 text-slate-400";
  if (d.includes("easy")) colorClass = "bg-emerald-500/20 text-emerald-400";
  else if (d.includes("medium")) colorClass = "bg-amber-500/20 text-amber-400";
  else if (d.includes("hard")) colorClass = "bg-rose-500/20 text-rose-400";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {difficulty || "Unknown"}
    </span>
  );
}

function StatusIcon({ solved, attempted }: { solved?: boolean; attempted?: boolean }) {
  if (solved) {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
        <svg className="h-3 w-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }
  if (attempted) {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20">
        <svg className="h-3 w-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }
  return <div className="h-5 w-5" />;
}

function TagChip({ tag, active, onClick }: { tag: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
        active
          ? "border-arena-primary/40 bg-arena-primary/20 text-arena-primaryStrong"
          : "border-white/10 bg-white/5 text-arena-muted hover:bg-white/10 hover:text-arena-text"
      }`}
    >
      {tag}
    </button>
  );
}

export default function ProblemsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Filters from URL
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const perPage = parseInt(searchParams.get("per_page") || "50", 10);
  const searchQuery = searchParams.get("search") || "";
  const difficultyFilter = searchParams.get("difficulty") || "";
  const statusFilter = searchParams.get("status") || "";
  const selectedTags = useMemo(() => {
    const tags = searchParams.get("tags");
    return tags ? tags.split(",").filter(Boolean) : [];
  }, [searchParams]);

  // Local search input state
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Fetch problems
  const fetchProblems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("per_page", String(perPage));
      if (searchQuery) params.set("q", searchQuery);
      if (difficultyFilter) params.set("difficulty", difficultyFilter);
      if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));

      const token = readStoredToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/problems?${params.toString()}`, { headers });
      const data: PaginatedResponse = await res.json();

      setProblems(data.items || []);
      setTotal(data.total || 0);
      if (data.available_tags) {
        setAvailableTags(data.available_tags);
      }
    } catch (err) {
      console.error("Failed to fetch problems:", err);
      setProblems([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, perPage, searchQuery, difficultyFilter, selectedTags]);

  useEffect(() => {
    fetchProblems();
  }, [fetchProblems]);

  // Filter handlers
  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set("page", "1"); // Reset to first page
    setSearchParams(newParams);
  };

  const toggleTag = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    updateFilter("tags", newTags.join(","));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter("search", searchInput);
  };

  const clearFilters = () => {
    setSearchParams({});
    setSearchInput("");
  };

  // Filtered problems by status (client-side for now)
  const filteredProblems = useMemo(() => {
    if (!statusFilter) return problems;
    return problems.filter((p) => {
      if (statusFilter === "solved") return p.is_solved;
      if (statusFilter === "attempted") return p.is_attempted && !p.is_solved;
      if (statusFilter === "unsolved") return !p.is_solved && !p.is_attempted;
      return true;
    });
  }, [problems, statusFilter]);

  const totalPages = Math.ceil(total / perPage);
  const hasActiveFilters = searchQuery || difficultyFilter || statusFilter || selectedTags.length > 0;

  // Use available tags from API or fallback to defaults
  const displayTags = availableTags.length > 0 ? availableTags : TOPIC_CATEGORIES;

  return (
    <DashboardShell
      eyebrow="Practice"
      title="Problems"
      subtitle="Master algorithms and data structures, one problem at a time."
    >
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar Filters */}
        <aside className="w-full shrink-0 lg:w-72">
          <div className="sticky top-20 space-y-4">
            {/* Search */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-semibold text-arena-text">Search</h3>
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search problems..."
                    className="w-full rounded-lg border border-white/10 bg-[#0b1220] px-4 py-2.5 text-sm text-arena-text placeholder-arena-muted focus:border-arena-primary/50 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-arena-muted hover:text-arena-text"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>

            {/* Difficulty Filter */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-semibold text-arena-text">Difficulty</h3>
              <div className="flex flex-wrap gap-2">
                {["", "Easy", "Medium", "Hard"].map((diff) => (
                  <button
                    key={diff || "all"}
                    type="button"
                    onClick={() => updateFilter("difficulty", diff)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      difficultyFilter === diff
                        ? "border-arena-primary/40 bg-arena-primary/20 text-arena-primaryStrong"
                        : "border-white/10 bg-white/5 text-arena-muted hover:bg-white/10"
                    }`}
                  >
                    {diff || "All"}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-semibold text-arena-text">Status</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "", label: "All" },
                  { value: "solved", label: "Solved" },
                  { value: "attempted", label: "Attempted" },
                  { value: "unsolved", label: "Todo" },
                ].map((opt) => (
                  <button
                    key={opt.value || "all"}
                    type="button"
                    onClick={() => updateFilter("status", opt.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      statusFilter === opt.value
                        ? "border-arena-primary/40 bg-arena-primary/20 text-arena-primaryStrong"
                        : "border-white/10 bg-white/5 text-arena-muted hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags Filter */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-semibold text-arena-text">Topics</h3>
              <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
                {displayTags.map((tag) => (
                  <TagChip
                    key={tag}
                    tag={tag}
                    active={selectedTags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                  />
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-arena-muted hover:bg-white/10 hover:text-arena-text"
              >
                Clear all filters
              </button>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="min-w-0 flex-1">
          {/* Stats Bar */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-arena-muted">
                Showing <span className="font-medium text-arena-text">{filteredProblems.length}</span> of{" "}
                <span className="font-medium text-arena-text">{total}</span> problems
              </span>
              {selectedTags.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-arena-muted">Tags:</span>
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-arena-primary/20 px-2 py-0.5 text-xs text-arena-primaryStrong"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className="ml-0.5 hover:text-white"
                      >
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="perPage" className="text-xs text-arena-muted">
                Per page:
              </label>
              <select
                id="perPage"
                value={perPage}
                onChange={(e) => updateFilter("per_page", e.target.value)}
                className="rounded-lg border border-white/10 bg-[#0b1220] px-2 py-1 text-sm text-arena-text focus:outline-none"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          {/* Problems Table */}
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-[#0b1220]/50">
                    <th className="w-12 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-arena-muted">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-arena-muted">
                      Title
                    </th>
                    <th className="w-24 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-arena-muted">
                      Difficulty
                    </th>
                    <th className="hidden w-28 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-arena-muted sm:table-cell">
                      Acceptance
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-arena-muted md:table-cell">
                      Tags
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-arena-muted">
                        <div className="flex items-center justify-center gap-2">
                          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Loading problems...
                        </div>
                      </td>
                    </tr>
                  ) : filteredProblems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-arena-muted">
                        No problems found. Try adjusting your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredProblems.map((problem) => (
                      <tr
                        key={problem.id || problem.slug}
                        className="group cursor-pointer transition-colors hover:bg-white/5"
                        onClick={() => navigate(`/problems/${problem.slug}`)}
                      >
                        <td className="px-4 py-3">
                          <StatusIcon solved={problem.is_solved} attempted={problem.is_attempted} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-arena-text group-hover:text-arena-primaryStrong">
                            {problem.title}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <DifficultyBadge difficulty={problem.difficulty} />
                        </td>
                        <td className="hidden px-4 py-3 text-sm text-arena-muted sm:table-cell">
                          {problem.acceptance_rate != null
                            ? `${Math.round(problem.acceptance_rate)}%`
                            : "--"}
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {(problem.tags || []).slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-arena-muted"
                              >
                                {tag}
                              </span>
                            ))}
                            {(problem.tags || []).length > 3 && (
                              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-arena-muted">
                                +{(problem.tags || []).length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-arena-muted">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateFilter("page", String(Math.max(1, currentPage - 1)))}
                  disabled={currentPage <= 1}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-arena-muted transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => updateFilter("page", String(page))}
                        className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                          page === currentPage
                            ? "bg-arena-primary/20 text-arena-primaryStrong"
                            : "text-arena-muted hover:bg-white/10"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => updateFilter("page", String(Math.min(totalPages, currentPage + 1)))}
                  disabled={currentPage >= totalPages}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-arena-muted transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </DashboardShell>
  );
}
