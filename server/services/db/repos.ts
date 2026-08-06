import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "./client";
import { repos } from "./schema";
import type { Repo } from "~~/shared/types";

type RepoRow = typeof repos.$inferSelect;

function toRepo(row: RepoRow): Repo {
  return {
    id: row.id,
    name_with_owner: row.nameWithOwner,
    discovered_at: row.discoveredAt.toISOString(),
  };
}

export async function upsertRepo(nameWithOwner: string): Promise<Repo> {
  // DO UPDATE no-op (self-assign) biar RETURNING selalu balik row, satu query.
  const [row] = await db()
    .insert(repos)
    .values({ nameWithOwner })
    .onConflictDoUpdate({
      target: repos.nameWithOwner,
      set: { nameWithOwner: sql`${repos.nameWithOwner}` },
    })
    .returning();
  return toRepo(row!);
}

export async function listRepos(): Promise<Repo[]> {
  const rows = await db().select().from(repos).orderBy(repos.nameWithOwner);
  return rows.map(toRepo);
}

export async function isFresh(nameWithOwner: string, refreshMinutes: number): Promise<boolean> {
  const [row] = await db()
    .select({ one: sql`1` })
    .from(repos)
    .where(
      and(
        eq(repos.nameWithOwner, nameWithOwner),
        gte(repos.lastCollectedAt, sql`now() - make_interval(mins => ${refreshMinutes})`),
      ),
    )
    .limit(1);
  return !!row;
}

export async function markCollected(nameWithOwner: string): Promise<void> {
  await db()
    .update(repos)
    .set({ lastCollectedAt: sql`now()` })
    .where(eq(repos.nameWithOwner, nameWithOwner));
}
