import { sql } from "drizzle-orm";
import { db } from "./client";
import type { AnalyticsData, AuthorBreakdown, ChurnPoint, RepoBreakdown, ReviewDecisionCount, StateCount, TrendPoint } from "~~/shared/types";

async function stateRatioQuery() {
  return (await db().execute(sql`
    SELECT state, count(*)::int AS count FROM prs GROUP BY state
  `)).rows as unknown as StateCount[];
}

async function totalQuery() {
  const rows = (await db().execute(sql`
    SELECT count(*)::int AS c FROM prs
  `)).rows as unknown as { c: number }[];
  return rows[0]?.c ?? 0;
}

async function repoCountQuery() {
  const rows = (await db().execute(sql`
    SELECT count(*)::int AS c FROM repos
  `)).rows as unknown as { c: number }[];
  return rows[0]?.c ?? 0;
}

async function reviewStatsQuery() {
  const rows = (await db().execute(sql`
    SELECT
      AVG(EXTRACT(EPOCH FROM (r.submitted_at - p.created_at)) / 86400.0)::float8 AS avg_days,
      count(*)::int AS reviewed
    FROM reviews r JOIN prs p ON p.id = r.pr_id
    WHERE r.status = 'submitted' AND r.submitted_at IS NOT NULL
  `)).rows as unknown as { avg_days: number | null; reviewed: number }[];
  const row = rows[0];
  return { avgDays: row?.avg_days ?? null, reviewed: row?.reviewed ?? 0 };
}

async function perRepoQuery() {
  return (await db().execute(sql`
    SELECT repo, "OPEN", "MERGED", "CLOSED" FROM (
      SELECT r.name_with_owner AS repo,
             SUM(CASE WHEN p.state='OPEN' THEN 1 ELSE 0 END)::int AS "OPEN",
             SUM(CASE WHEN p.state='MERGED' THEN 1 ELSE 0 END)::int AS "MERGED",
             SUM(CASE WHEN p.state='CLOSED' THEN 1 ELSE 0 END)::int AS "CLOSED"
      FROM prs p JOIN repos r ON r.id = p.repo_id
      GROUP BY r.name_with_owner
    ) t
    ORDER BY ("OPEN" + "MERGED" + "CLOSED") DESC
    LIMIT 15
  `)).rows as unknown as RepoBreakdown[];
}

async function perAuthorQuery() {
  return (await db().execute(sql`
    SELECT author_login AS author, count(*)::int AS count
    FROM prs GROUP BY author_login ORDER BY count DESC LIMIT 15
  `)).rows as unknown as AuthorBreakdown[];
}

// ISO week: to_char IYYY-"W"IW — padanannya strftime('%Y-W%W') SQLite
async function trendQuery() {
  return (await db().execute(sql`
    SELECT to_char(created_at, 'IYYY-"W"IW') AS week,
           SUM(CASE WHEN state='OPEN' THEN 1 ELSE 0 END)::int AS "OPEN",
           SUM(CASE WHEN state='MERGED' THEN 1 ELSE 0 END)::int AS "MERGED",
           SUM(CASE WHEN state='CLOSED' THEN 1 ELSE 0 END)::int AS "CLOSED"
    FROM prs
    WHERE created_at >= now() - interval '365 days'
    GROUP BY week ORDER BY week
  `)).rows as unknown as TrendPoint[];
}

async function mergeTimeQuery(): Promise<number | null> {
  const rows = (await db().execute(sql`
    SELECT AVG(EXTRACT(EPOCH FROM (merged_at - created_at)) / 86400.0)::float8 AS avg_days
    FROM prs WHERE merged_at IS NOT NULL
  `)).rows as unknown as { avg_days: number | null }[];
  return rows[0]?.avg_days ?? null;
}

async function draftCountQuery(): Promise<number> {
  const rows = (await db().execute(sql`
    SELECT count(*)::int AS c FROM prs WHERE is_draft = true
  `)).rows as unknown as { c: number }[];
  return rows[0]?.c ?? 0;
}

async function reviewDecisionQuery(): Promise<ReviewDecisionCount[]> {
  return (await db().execute(sql`
    SELECT COALESCE(review_decision, '(none)') AS decision, count(*)::int AS count
    FROM prs GROUP BY decision ORDER BY count DESC
  `)).rows as unknown as ReviewDecisionCount[];
}

async function codeChurnQuery(): Promise<ChurnPoint[]> {
  return (await db().execute(sql`
    SELECT r.name_with_owner AS repo,
           SUM(p.additions)::int AS additions,
           SUM(p.deletions)::int AS deletions
    FROM prs p JOIN repos r ON r.id = p.repo_id
    GROUP BY r.name_with_owner
    ORDER BY (SUM(p.additions) + SUM(p.deletions)) DESC
    LIMIT 15
  `)).rows as unknown as ChurnPoint[];
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const [stateRatio, total, repoCount, reviewStats, perRepo, perAuthor, trend, mergeTime, draftCount, reviewDecisions, codeChurn] = await Promise.all([
    stateRatioQuery(),
    totalQuery(),
    repoCountQuery(),
    reviewStatsQuery(),
    perRepoQuery(),
    perAuthorQuery(),
    trendQuery(),
    mergeTimeQuery(),
    draftCountQuery(),
    reviewDecisionQuery(),
    codeChurnQuery(),
  ]);
  return {
    total,
    repoCount,
    stateRatio,
    avgTimeToReviewDays: reviewStats.avgDays,
    reviewedCount: reviewStats.reviewed,
    perRepo,
    perAuthor,
    trend,
    avgMergeTimeDays: mergeTime,
    draftCount,
    reviewDecisions,
    codeChurn,
  };
}
