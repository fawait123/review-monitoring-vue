export type PRState = "OPEN" | "MERGED" | "CLOSED";
export type ReviewStatus = "draft" | "submitted";
export type CommentStatus = "draft" | "submitted";

export type PrdStatus = "draft" | "generated" | "pushed";
export type PrdTaskStatus = "todo" | "in_progress" | "done";

export const PRD_STACK_FIELDS = ["frontend", "backend", "database", "server"] as const;
export type PrdStackField = (typeof PRD_STACK_FIELDS)[number];
/** Pilihan stack per kategori — nilai bebas, contoh: { frontend: "nuxtjs", database: "postgresql" } */
export type PrdStackInput = Partial<Record<PrdStackField, string>>;

export interface Prd {
  id: number;
  title: string;
  promptInput: string;
  content: string;
  status: PrdStatus;
  repoNameWithOwner: string | null;
  ghPrNumber: number | null;
  ghPrUrl: string | null;
  createdAt: string;
  updatedAt: string;
  generatedBy: string | null;
  taskCount: number;
}

export interface PrdTask {
  id: number;
  prdId: number;
  title: string;
  description: string;
  acceptanceCriteria: string;
  status: PrdTaskStatus;
  ghIssueNumber: number | null;
  createdAt: string;
}

export interface TaskDraft {
  title: string;
  description: string;
  acceptanceCriteria: string;
}

export interface Repo {
  id: number;
  name_with_owner: string;
  discovered_at: string;
}

export interface PR {
  id: number;
  repoId: number;
  number: number;
  title: string;
  authorLogin: string;
  authorName: string | null;
  state: PRState;
  isDraft: boolean;
  additions: number;
  deletions: number;
  reviewDecision: string | null;
  headRefOid: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  repo?: string;
  submitted: boolean;
  draft: boolean;
  decision: "SUBMITTED" | "DRAFT" | null;
}

export interface Review {
  id: number;
  prId: number;
  status: ReviewStatus;
  summary: string;
  piModel: string | null;
  createdAt: string;
  submittedAt: string | null;
  ghReviewId: string | null;
}

export interface ReviewComment {
  id: number;
  reviewId: number;
  path: string;
  line: number;
  side: string;
  body: string;
  position: number;
  status: CommentStatus;
  ghCommentId: string | null;
}

export interface CollectedPR {
  number: number;
  title: string;
  authorLogin: string;
  authorName: string | null;
  state: "OPEN" | "MERGED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  url: string;
  headRefOid: string;
  isDraft: boolean;
  additions: number;
  deletions: number;
  reviewDecision: string | null;
}

export interface ReviewResult {
  summary: string;
  comments: { path: string; line: number; body: string }[];
}

export interface DiffFile {
  path: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export type DiffLineKind = "context" | "add" | "del";

export interface DiffLine {
  kind: DiffLineKind;
  oldLine: number | null;
  newLine: number | null;
  content: string;
}

export interface StateCount {
  state: string;
  count: number;
}

export interface RepoBreakdown {
  repo: string;
  OPEN: number;
  MERGED: number;
  CLOSED: number;
}

export interface AuthorBreakdown {
  author: string;
  count: number;
}

export interface TrendPoint {
  week: string;
  OPEN: number;
  MERGED: number;
  CLOSED: number;
}

export interface ChurnPoint {
  repo: string;
  additions: number;
  deletions: number;
}

export interface ReviewDecisionCount {
  decision: string;
  count: number;
}

export interface AnalyticsData {
  total: number;
  repoCount: number;
  stateRatio: StateCount[];
  avgTimeToReviewDays: number | null;
  reviewedCount: number;
  perRepo: RepoBreakdown[];
  perAuthor: AuthorBreakdown[];
  trend: TrendPoint[];
  /** Rata-rata hari dari created_at ke merged_at (merged PRs saja) */
  avgMergeTimeDays: number | null;
  /** Jumlah PR yang merupakan draft */
  draftCount: number;
  /** Breakdown review_decision (APPROVED, CHANGES_REQUESTED, REVIEW_REQUIRED, null) */
  reviewDecisions: ReviewDecisionCount[];
  /** Total additions/deletions per repo (top 15) */
  codeChurn: ChurnPoint[];
}
