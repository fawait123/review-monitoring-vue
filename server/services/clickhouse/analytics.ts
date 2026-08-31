import { ch } from "./client";
import type {
  AnalyticsData,
  AuthorBreakdown,
  ChurnPoint,
  RepoBreakdown,
  ReviewDecisionCount,
  StateCount,
  TrendPoint,
} from "~~/shared/types";

// ponytail: query native ClickHouse ("JSONEachRow") — bukan emulasi drizzle/pg.
// count(*)::int → count() (UInt64). JOIN di-pegang manual via `JOIN` SQL string.

async function stateRatioQuery(): Promise<StateCount[]> {
  const query = await ch().query({ query: `SELECT state, count() AS count FROM prs GROUP BY state`, format: 'JSONEachRow' })
  return await query.json();
}

async function totalQuery(): Promise<number> {
  const resultSet = await ch().query({
    query: `SELECT count() AS c FROM prs`,
    format: "JSONEachRow",
  });
  const rows = await resultSet.json<{ c: number }>();
  return rows?.[0]?.c ?? 0;
}

async function repoCountQuery(): Promise<number> {
  const resultSet = await ch().query({
    query: `SELECT count() AS c FROM repos`,
    format: "JSONEachRow",
  });
  const rows = await resultSet.json<{ c: number }>();
  return rows?.[0]?.c ?? 0;
}

async function reviewStatsQuery(): Promise<{ avgDays: number | null; reviewed: number }> {
  const resultSet = await ch().query({
    query: `SELECT
      avg(dateDiff('second', toDateTime(p.created_at), toDateTime(r.submitted_at)) / 86400.0) AS avg_days,
      count() AS reviewed
    FROM prs p
    JOIN reviews r ON p.id = r.pr_id
    WHERE r.status = 'submitted' AND r.submitted_at IS NOT NULL`,
    format: "JSONEachRow",
  });
  const rows = await resultSet.json<{ avg_days: number | null; reviewed: number }>();
  const row = rows?.[0];
  return { avgDays: row?.avg_days ?? null, reviewed: row?.reviewed ?? 0 };
}

async function perRepoQuery(): Promise<RepoBreakdown[]> {
  const resultSet = await ch().query({
    query: `SELECT
      repo,
      countIf(state = 'OPEN') AS OPEN,
      countIf(state = 'MERGED') AS MERGED,
      countIf(state = 'CLOSED') AS CLOSED
    FROM prs
    GROUP BY repo
    ORDER BY (OPEN + MERGED + CLOSED) DESC
    LIMIT 15`,
    format: "JSONEachRow",
  });
  const rows = await resultSet.json<RepoBreakdown>();
  return rows ?? [];
}

async function perAuthorQuery(): Promise<AuthorBreakdown[]> {
  const query = await ch().query({ query: `SELECT author_login AS author, count() AS count FROM prs GROUP BY author_login ORDER BY count DESC LIMIT 15`, format: 'JSONEachRow' })
  return await query.json()
}

// ponytail: ISO week — formatDateTime('%Y-%%W') padanannya strftime('%V-%V') PostgreSQL.
async function trendQuery(): Promise<TrendPoint[]> {
  const query = await ch().query({
    query: `SELECT
      formatDateTime(created_at, '%G-W%V') AS week,
      countIf(state = 'OPEN') AS OPEN,
      countIf(state = 'MERGED') AS MERGED,
      countIf(state = 'CLOSED') AS CLOSED
    FROM prs
    WHERE created_at >= subtractDays(now(), 365)
    GROUP BY week ORDER BY week`, format: 'JSONEachRow'
  })
  return await query.json()
}

// ponytail: review_decision — null=kosong (belum di-review/draft), APPROVED, CHANGES_REQUESTED, REVIEW_REQUIRED
async function reviewDecisionQuery(): Promise<ReviewDecisionCount[]> {
  const query = await ch().query({
    query: `SELECT COALESCE(review_decision, '(none)') AS decision, count() AS count FROM prs GROUP BY decision ORDER BY count DESC`,
    format: 'JSONEachRow',
  })
  return await query.json()
}

async function mergeTimeQuery(): Promise<number | null> {
  const query = await ch().query({
    query: `SELECT avg(dateDiff('second', toDateTime(created_at), toDateTime(merged_at)) / 86400.0) AS avg_days FROM prs WHERE merged_at IS NOT NULL`,
    format: 'JSONEachRow',
  })
  const rows = await query.json<{ avg_days: number | null }>()
  return rows?.[0]?.avg_days ?? null
}

async function draftCountQuery(): Promise<number> {
  const query = await ch().query({
    query: `SELECT count() AS c FROM prs WHERE is_draft = true`,
    format: 'JSONEachRow',
  })
  const rows = await query.json<{ c: number }>()
  return rows?.[0]?.c ?? 0
}

// ponytail: code churn = total additions + deletions per repo (top 15)
async function codeChurnQuery(): Promise<ChurnPoint[]> {
  const query = await ch().query({
    query: `SELECT repo, sum(additions) AS additions, sum(deletions) AS deletions FROM prs GROUP BY repo ORDER BY (additions + deletions) DESC LIMIT 15`,
    format: 'JSONEachRow',
  })
  return await query.json()
}

export async function getClickhouseAnalyticsData(): Promise<AnalyticsData> {
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
