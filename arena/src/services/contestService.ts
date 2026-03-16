import { API_BASE_URL } from "../lib/apiClient.js";

type ContestStatus = "upcoming" | "running" | "finished";

export type ContestListItem = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  status: ContestStatus;
};

export type ContestProblemItem = {
  problem_id: string;
  problem_slug: string;
  title: string | null;
  difficulty: string | null;
  sort_order: number;
};

export type ContestDetail = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  problems: ContestProblemItem[];
};

export type ContestLeaderboardRow = {
  username: string;
  solved: number;
  penalty_minutes: number;
};

async function requestJson(path: string) {
  const res = await fetch(`${API_BASE_URL}${path}`);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.detail || data?.message || `HTTP ${res.status}`;
    const err: any = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const contestService = {
  list(): Promise<ContestListItem[]> {
    return requestJson("/api/contests").then((d) => d?.items || []);
  },
  get(id: string): Promise<ContestDetail> {
    return requestJson(`/api/contests/${encodeURIComponent(id)}`);
  },
  leaderboard(id: string): Promise<ContestLeaderboardRow[]> {
    return requestJson(`/api/contests/${encodeURIComponent(id)}/leaderboard`).then((d) => d?.items || []);
  },
};

