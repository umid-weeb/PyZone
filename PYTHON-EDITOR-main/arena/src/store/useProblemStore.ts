import { create } from "zustand";

type ProblemStoreState = {
  aiHint: string | null;
  isHintLoading: boolean;
  setAiHint: (value: string | null) => void;
  setHintLoading: (value: boolean) => void;
  resetHint: () => void;
};

export const useProblemStore = create<ProblemStoreState>((set) => ({
  aiHint: null,
  isHintLoading: false,
  setAiHint: (value) => set({ aiHint: value }),
  setHintLoading: (value) => set({ isHintLoading: value }),
  resetHint: () => set({ aiHint: null, isHintLoading: false }),
}));
