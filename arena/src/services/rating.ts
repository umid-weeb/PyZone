export type RatingTier = {
  key: string;
  label: string;
  min: number;
  colorClass: string;
};

export const RATING_TIERS: RatingTier[] = [
  { key: "newbie", label: "Newbie", min: 0, colorClass: "text-[#9aa4b2]" },
  { key: "pupil", label: "Pupil", min: 1200, colorClass: "text-[#7ee787]" },
  { key: "specialist", label: "Specialist", min: 1400, colorClass: "text-[#60a5fa]" },
  { key: "expert", label: "Expert", min: 1600, colorClass: "text-[#a78bfa]" },
  { key: "candidate_master", label: "Candidate Master", min: 1900, colorClass: "text-[#fbbf24]" },
  { key: "master", label: "Master", min: 2100, colorClass: "text-[#fb7185]" },
  { key: "grandmaster", label: "Grandmaster", min: 2400, colorClass: "text-[#f87171]" },
];

export function resolveRatingTier(rating: number | null | undefined): RatingTier {
  const value = Number.isFinite(Number(rating)) ? Number(rating) : 0;
  let best = RATING_TIERS[0];
  for (const tier of RATING_TIERS) {
    if (value >= tier.min) best = tier;
  }
  return best;
}

