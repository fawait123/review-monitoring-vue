import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { prs, repos, reviews } from "./schema";
import type { CollectedPR, PR, PRState } from "~~/shared/types";

type PRRow = typeof prs.$inferSelect & { repo: string };
type PRBase = typeof prs.$inferSelect;

function toPR(row: PRRow, counts: Map<number, { submitted: boolean; draft: boolean }>): PR {
  const c = counts.get(row.id);
  const submitted = c?.submitted ?? false;
  const draft = c?.draft ?? false;
  return {
    id: row.id,
    repoId: row.repoId,
    number: row.number,
    title: row.title,
    authorLogin: row.authorLogin,
    authorName: row.authorName,
    state: row.state,
    isDraft: row.isDraft,
    additions: row.additions,
    deletions: row.deletions,
    reviewDecision: row.reviewDecision,
    headRefOid: row.headRefOid,
    url: row.url,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    mergedAt: row.mergedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    repo: row.repo,
    submitted,
    draft,
    decision: submitted ? "SUBMITTED" : draft ? "DRAFT" : null,
  };
}

const baseSelect = db()
  .select({
    id: prs.id,
    repoId: prs.repoId,
    number: prs.number,
    title: prs.title,
    authorLogin: prs.authorLogin,
    authorName: prs.authorName,
    state: prs.state,
    isDraft: prs.isDraft,
    additions: prs.additions,
    deletions: prs.deletions,
    reviewDecision: prs.reviewDecision,
    headRefOid: prs.headRefOid,
    url: prs.url,
    createdAt: prs.createdAt,
    updatedAt: prs.updatedAt,
    mergedAt: prs.mergedAt,
    closedAt: prs.closedAt,
    repo: repos.nameWithOwner,
  })
  .from(prs)
  .innerJoin(repos, eq(prs.repoId, repos.id))
  .$dynamic();

function reviewCountsFor(ids: number[]): Promise<Map<number, { submitted: boolean; draft: boolean }>> {
  if (ids.length === 0) return Promise.resolve(new Map());
  return db()
    .select({ prId: reviews.prId, status: reviews.status, n: sql<number>`count(*)::int` })
    .from(reviews)
    .where(inArray(reviews.prId, ids))
    .groupBy(reviews.prId, reviews.status)
    .then((rows) => {
      const map = new Map<number, { submitted: boolean; draft: boolean }>();
      for (const r of rows) {
        const cur = map.get(r.prId) ?? { submitted: false, draft: false };
        if (r.status === "submitted") cur.submitted = r.n > 0;
        if (r.status === "draft") cur.draft = r.n > 0;
        map.set(r.prId, cur);
      }
      return map;
    });
}

export async function upsertPR(input: { repoId: number } & CollectedPR): Promise<void> {
  await db()
    .insert(prs)
    .values({
      repoId: input.repoId,
      number: input.number,
      title: input.title,
      authorLogin: input.authorLogin,
      authorName: input.authorName,
      state: input.state,
      isDraft: input.isDraft,
      additions: input.additions,
      deletions: input.deletions,
      reviewDecision: input.reviewDecision,
      headRefOid: input.headRefOid,
      url: input.url,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
      mergedAt: input.mergedAt ? new Date(input.mergedAt) : null,
      closedAt: input.closedAt ? new Date(input.closedAt) : null,
    })
    .onConflictDoUpdate({
      target: [prs.repoId, prs.number],
      set: {
        title: input.title,
        authorLogin: input.authorLogin,
        authorName: input.authorName,
        state: input.state,
        isDraft: input.isDraft,
        additions: input.additions,
        deletions: input.deletions,
        reviewDecision: input.reviewDecision,
        headRefOid: input.headRefOid,
        url: input.url,
        createdAt: new Date(input.createdAt),
        updatedAt: new Date(input.updatedAt),
        mergedAt: input.mergedAt ? new Date(input.mergedAt) : null,
        closedAt: input.closedAt ? new Date(input.closedAt) : null,
      },
    });
}

export async function listPRs(
  repo?: string,
  state?: string,
  limit = 1000,
  offset = 0,
): Promise<PR[]> {
  const conds = [];
  if (repo) conds.push(eq(repos.nameWithOwner, repo));
  if (state) conds.push(eq(prs.state, state as PRState));

  const rows = (await baseSelect
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(prs.updatedAt))
    .limit(limit)
    .offset(offset)) as PRRow[];
  const counts = await reviewCountsFor(rows.map((r) => r.id));
  return rows.map((r) => toPR(r, counts));
}

export async function countPRs(repo?: string, state?: string): Promise<number> {
  const conds = [];
  if (repo) conds.push(eq(repos.nameWithOwner, repo));
  if (state) conds.push(eq(prs.state, state as PRState));
  const [row] = await db()
    .select({ total: sql<number>`count(*)::int` })
    .from(prs)
    .innerJoin(repos, eq(prs.repoId, repos.id))
    .where(conds.length ? and(...conds) : undefined);
  return row?.total ?? 0;
}

export async function updatePRState(id: number, state: PRState): Promise<void> {
  await db().update(prs).set({ state }).where(eq(prs.id, id));
}

async function getPRWhere(where: ReturnType<typeof and> | undefined): Promise<PR | null> {
  const rows = (await baseSelect.where(where).limit(1)) as PRRow[];
  if (!rows[0]) return null;
  const counts = await reviewCountsFor([rows[0].id]);
  return toPR(rows[0], counts);
}

export async function getPR(id: number): Promise<PR | null> {
  return getPRWhere(eq(prs.id, id));
}

export async function getPRByKey(nameWithOwner: string, number: number): Promise<PR | null> {
  return getPRWhere(and(eq(repos.nameWithOwner, nameWithOwner), eq(prs.number, number)));
}
