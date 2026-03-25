import { create } from 'zustand';

export interface TestCase {
  id: string;
  input: string;
  expected: string;
  actual?: string;
  status?: 'idle' | 'running' | 'accepted' | 'wrong' | 'error';
}

export interface AIReviewData {
  time_complexity: { detected: string; optimal: string; suggestion: string };
  space_complexity: { detected: string; suggestion: string };
  edge_cases: string[];
  code_style: string[];
  alternative: string | null;
  overall_score: number;
}

interface ProblemState {
  code: string;
  language: string;
  submissionStatus: 'idle' | 'running' | 'accepted' | 'wrong' | 'error';
  testCases: TestCase[];
  activeTestCaseId: string;
  aiHint: string | null;
  hintAttemptCount: number;
  isHintLoading: boolean;
  aiReview: AIReviewData | null;
  isReviewLoading: boolean;
  
  setCode: (code: string) => void;
  setLanguage: (lang: string) => void;
  setSubmissionStatus: (status: ProblemState['submissionStatus']) => void;
  setTestCases: (cases: TestCase[]) => void;
  setActiveTestCaseId: (id: string) => void;
  setAiHint: (hint: string | null) => void;
  requestHint: (problemTitle: string, problemDescription: string) => Promise<void>;
  requestReview: (problemTitle: string) => Promise<void>;
}

export const useProblemStore = create<ProblemState>((set, get) => ({
  code: 'class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        pass',
  language: 'python',
  submissionStatus: 'idle',
  testCases: [
    { id: '1', input: 'nums = [2,7,11,15]\ntarget = 9', expected: '[0,1]', status: 'idle' },
    { id: '2', input: 'nums = [3,2,4]\ntarget = 6', expected: '[1,2]', status: 'idle' },
  ],
  activeTestCaseId: '1',
  aiHint: null,
  hintAttemptCount: 0,
  isHintLoading: false,
  aiReview: null,
  isReviewLoading: false,
  
  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
  setSubmissionStatus: (status) => set({ submissionStatus: status }),
  setTestCases: (testCases) => set({ testCases }),
  setActiveTestCaseId: (activeTestCaseId) => set({ activeTestCaseId }),
  setAiHint: (aiHint) => set({ aiHint }),

  requestHint: async (problemTitle, problemDescription) => {
    const state = get();
    set({ isHintLoading: true, aiHint: null });

    try {
      const nextAttempt = state.hintAttemptCount + 1;
      const response = await fetch('http://localhost:3004/api/hints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_title: problemTitle,
          problem_description: problemDescription,
          user_code: state.code,
          attempt_count: nextAttempt,
          language: state.language
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'AI xizmatidan javob olishda xatolik.');
      }

      set({
        aiHint: data.hint_text || data.hint,
        hintAttemptCount: nextAttempt,
        isHintLoading: false
      });
    } catch (error: any) {
      set({
        aiHint: error.message || 'Tarmoq xatosi yoki server ishlamayapti.',
        isHintLoading: false
      });
    }
  },

  requestReview: async (problemTitle) => {
    const state = get();
    set({ isReviewLoading: true, aiReview: null });

    try {
      const response = await fetch('http://localhost:3004/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_title: problemTitle,
          code: state.code,
          language: state.language
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'AI xizmatidan javob olishda xatolik.');
      }

      set({ aiReview: data, isReviewLoading: false });
    } catch (error: any) {
      console.error("Review Error: ", error);
      set({ isReviewLoading: false });
    }
  }
}));