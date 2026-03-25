type Badge = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  earned: boolean;
  progress?: number;
  maxProgress?: number;
};

type BadgeDisplayProps = {
  solvedCount: number;
  currentStreak: number;
  bestStreak: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  contestsParticipated?: number;
};

function BadgeIcon({ children, earned }: { children: React.ReactNode; earned: boolean }) {
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-all ${
        earned
          ? "border-arena-primary/40 bg-arena-primary/20 text-arena-primaryStrong"
          : "border-white/10 bg-white/5 text-arena-muted opacity-50 grayscale"
      }`}
    >
      {children}
    </div>
  );
}

export default function BadgeDisplay({
  solvedCount,
  currentStreak,
  bestStreak,
  easySolved,
  mediumSolved,
  hardSolved,
  contestsParticipated = 0,
}: BadgeDisplayProps) {
  const badges: Badge[] = [
    // Milestone badges
    {
      id: "first-solve",
      name: "First Blood",
      description: "Solve your first problem",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      earned: solvedCount >= 1,
    },
    {
      id: "ten-problems",
      name: "Warming Up",
      description: "Solve 10 problems",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
        </svg>
      ),
      earned: solvedCount >= 10,
      progress: Math.min(solvedCount, 10),
      maxProgress: 10,
    },
    {
      id: "fifty-problems",
      name: "Dedicated Coder",
      description: "Solve 50 problems",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
      earned: solvedCount >= 50,
      progress: Math.min(solvedCount, 50),
      maxProgress: 50,
    },
    {
      id: "hundred-problems",
      name: "Centurion",
      description: "Solve 100 problems",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      earned: solvedCount >= 100,
      progress: Math.min(solvedCount, 100),
      maxProgress: 100,
    },
    // Streak badges
    {
      id: "week-streak",
      name: "Consistent",
      description: "7 day streak",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      earned: bestStreak >= 7,
      progress: Math.min(bestStreak, 7),
      maxProgress: 7,
    },
    {
      id: "month-streak",
      name: "Unstoppable",
      description: "30 day streak",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      earned: bestStreak >= 30,
      progress: Math.min(bestStreak, 30),
      maxProgress: 30,
    },
    // Difficulty mastery
    {
      id: "easy-master",
      name: "Easy Mode",
      description: "Solve 20 easy problems",
      icon: (
        <svg className="h-6 w-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      earned: easySolved >= 20,
      progress: Math.min(easySolved, 20),
      maxProgress: 20,
    },
    {
      id: "medium-master",
      name: "Getting Serious",
      description: "Solve 15 medium problems",
      icon: (
        <svg className="h-6 w-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      earned: mediumSolved >= 15,
      progress: Math.min(mediumSolved, 15),
      maxProgress: 15,
    },
    {
      id: "hard-master",
      name: "Hardcore",
      description: "Solve 10 hard problems",
      icon: (
        <svg className="h-6 w-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      earned: hardSolved >= 10,
      progress: Math.min(hardSolved, 10),
      maxProgress: 10,
    },
    // Contest badge
    {
      id: "contest-participant",
      name: "Competitor",
      description: "Participate in a contest",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 4v12l-4-2-4 2V4M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      earned: contestsParticipated >= 1,
    },
  ];

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-arena-text">Badges</h2>
        <span className="text-xs text-arena-muted">
          {earnedCount}/{badges.length} earned
        </span>
      </div>
      <div className="grid grid-cols-5 gap-3 sm:grid-cols-5 md:grid-cols-10">
        {badges.map((badge) => (
          <div key={badge.id} className="group relative">
            <BadgeIcon earned={badge.earned}>{badge.icon}</BadgeIcon>
            {/* Tooltip */}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="whitespace-nowrap rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-center shadow-lg">
                <div className="text-xs font-medium text-arena-text">{badge.name}</div>
                <div className="mt-0.5 text-[10px] text-arena-muted">{badge.description}</div>
                {badge.progress !== undefined && badge.maxProgress !== undefined && !badge.earned && (
                  <div className="mt-1 text-[10px] text-arena-primary">
                    {badge.progress}/{badge.maxProgress}
                  </div>
                )}
              </div>
              <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#0b1220]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
