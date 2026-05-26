// Shared domain types + vocab. The skill/topic vocab mirrors the solver so
// matching scores are meaningful.

export type RemainderPolicy =
  | "strict_best_fit"
  | "strict_manual"
  | "flexible_range";

export type StragglerPolicy = "neutral_default" | "nudge" | "exclude";

export type EventState =
  | "draft"
  | "enrolling"
  | "matched"
  | "in_progress"
  | "peer_review"
  | "closed";

export type CommStyle = "sync" | "async" | "mixed";

export const SKILLS = [
  "frontend",
  "backend",
  "databases",
  "ml",
  "design",
  "python",
  "devops",
  "math",
  "writing",
] as const;

export const TOPICS = [
  "ai",
  "web",
  "infra",
  "nlp",
  "ux",
  "security",
  "research",
] as const;

// 14 weekly slots: 7 days × {morning, evening}.
export const SLOTS: { id: number; label: string }[] = [
  ...["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].flatMap((d, i) => [
    { id: i, label: `${d} AM` },
    { id: i + 7, label: `${d} PM` },
  ]),
];

export const REMAINDER_POLICY_LABELS: Record<RemainderPolicy, string> = {
  strict_best_fit: "Strict size, auto-place extras (recommended)",
  strict_manual: "Strict size, I'll place extras manually",
  flexible_range: "Flexible team sizes within a range",
};

export const STRAGGLER_POLICY_LABELS: Record<StragglerPolicy, string> = {
  neutral_default: "Match them on a neutral profile (recommended)",
  nudge: "Hold their spot and remind them",
  exclude: "Leave them out (I'll handle it)",
};

export type EventRow = {
  id: string;
  owner_id: string;
  course_label: string;
  target_team_size: number;
  remainder_policy: RemainderPolicy;
  min_size: number | null;
  max_size: number | null;
  straggler_policy: StragglerPolicy;
  state: EventState;
  target_end_date: string | null;
  is_demo: boolean;
  join_code: string | null;
  created_at: string;
};
