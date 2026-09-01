import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { prds, prdTasks } from "./schema";
import type { Prd, PrdTask, PrdStatus, PrdTaskStatus } from "~~/shared/types";

type PrdRow = typeof prds.$inferSelect;
type TaskRow = typeof prdTasks.$inferSelect;

function toPrd(row: PrdRow, taskCount: number): Prd {
  return {
    id: row.id,
    title: row.title,
    promptInput: row.promptInput,
    content: row.content,
    status: row.status,
    repoNameWithOwner: row.repoNameWithOwner,
    ghPrNumber: row.ghPrNumber,
    ghPrUrl: row.ghPrUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    generatedBy: row.generatedBy,
    taskCount,
  };
}

function toTask(row: TaskRow): PrdTask {
  return {
    id: row.id,
    prdId: row.prdId,
    title: row.title,
    description: row.description,
    acceptanceCriteria: row.acceptanceCriteria,
    status: row.status,
    ghIssueNumber: row.ghIssueNumber,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createPrd(input: {
  title: string;
  promptInput: string;
  content: string;
  generatedBy: string | null;
}): Promise<Prd> {
  const [row] = await db().insert(prds).values(input).returning();
  return toPrd(row!, 0);
}

export async function getPrd(id: number): Promise<Prd | null> {
  const [row] = await db()
    .select({
      prd: prds,
      taskCount: sql<number>`count(${prdTasks.id})::int`,
    })
    .from(prds)
    .leftJoin(prdTasks, eq(prdTasks.prdId, prds.id))
    .where(eq(prds.id, id))
    .groupBy(prds.id)
    .limit(1);
  return row ? toPrd(row.prd, row.taskCount) : null;
}

export async function listPrds(): Promise<Prd[]> {
  const rows = await db()
    .select({
      prd: prds,
      taskCount: sql<number>`count(${prdTasks.id})::int`,
    })
    .from(prds)
    .leftJoin(prdTasks, eq(prdTasks.prdId, prds.id))
    .groupBy(prds.id)
    .orderBy(desc(prds.updatedAt));
  return rows.map((r) => toPrd(r.prd, r.taskCount));
}

export async function updatePrd(
  id: number,
  data: Partial<{ title: string; content: string; status: PrdStatus; repoNameWithOwner: string | null; ghPrNumber: number | null; ghPrUrl: string | null }>,
): Promise<void> {
  await db()
    .update(prds)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(prds.id, id));
}

export async function listTasks(prdId: number): Promise<PrdTask[]> {
  const rows = await db()
    .select()
    .from(prdTasks)
    .where(eq(prdTasks.prdId, prdId))
    .orderBy(prdTasks.id);
  return rows.map(toTask);
}

export async function getTask(id: number): Promise<PrdTask | null> {
  const [row] = await db().select().from(prdTasks).where(eq(prdTasks.id, id)).limit(1);
  return row ? toTask(row) : null;
}

export async function updateTask(
  id: number,
  data: Partial<{ title: string; description: string; acceptanceCriteria: string; status: PrdTaskStatus; ghIssueNumber: number | null }>,
): Promise<void> {
  await db().update(prdTasks).set(data).where(eq(prdTasks.id, id));
}

export async function replaceTasks(prdId: number, tasks: { title: string; description: string; acceptanceCriteria: string }[]): Promise<PrdTask[]> {
  return db().transaction(async (tx) => {
    await tx.delete(prdTasks).where(eq(prdTasks.prdId, prdId));
    const rows: TaskRow[] = [];
    for (const t of tasks) {
      const [row] = await tx.insert(prdTasks).values({ prdId, ...t }).returning();
      rows.push(row!);
    }
    return rows.map(toTask);
  });
}
