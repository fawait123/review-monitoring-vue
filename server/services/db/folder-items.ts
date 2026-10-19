import { asc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "./client";
import { folderItems } from "./schema";
import type { FolderItem, FolderItemKind } from "~~/shared/types";

type ItemRow = typeof folderItems.$inferSelect;

function toItem(row: ItemRow): FolderItem {
  return {
    id: row.id,
    parentId: row.parentId,
    kind: row.kind,
    name: row.name,
    url: row.url,
    originalName: row.originalName,
    fileSize: row.fileSize,
    contentType: row.contentType,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listItems(): Promise<FolderItem[]> {
  const rows = await db().select().from(folderItems).orderBy(asc(folderItems.name));
  return rows.map(toItem);
}

export async function getItem(id: number): Promise<FolderItem | null> {
  const [row] = await db().select().from(folderItems).where(eq(folderItems.id, id)).limit(1);
  return row ? toItem(row) : null;
}

export async function createItem(input: {
  parentId: number | null;
  kind: FolderItemKind;
  name: string;
  url?: string | null;
  storageKey?: string | null;
  originalName?: string | null;
  fileSize?: number | null;
  contentType?: string | null;
}): Promise<FolderItem> {
  const [row] = await db().insert(folderItems).values(input).returning();
  return toItem(row!);
}

export async function updateItem(
  id: number,
  data: Partial<{ name: string; url: string | null; parentId: number | null }>,
): Promise<void> {
  await db()
    .update(folderItems)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(folderItems.id, id));
}

export async function deleteItem(id: number): Promise<void> {
  await db().delete(folderItems).where(eq(folderItems.id, id));
}

// Sumber data unduhan — satu-satunya jalur yang mengekspos storage key.
export interface DownloadSource {
  id: number;
  kind: FolderItemKind;
  name: string;
  storageKey: string | null;
  originalName: string | null;
  fileSize: number | null;
  contentType: string | null;
}

export async function getDownloadSource(id: number): Promise<DownloadSource | null> {
  const [row] = await db().select().from(folderItems).where(eq(folderItems.id, id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    storageKey: row.storageKey,
    originalName: row.originalName,
    fileSize: row.fileSize,
    contentType: row.contentType,
  };
}

// Storage key item ini + seluruh descendant (untuk sweep MinIO saat delete folder).
export async function fileKeysInSubtree(id: number): Promise<string[]> {
  const result = await db().execute(sql<{ storage_key: string }>`
    WITH RECURSIVE subtree AS (
      SELECT id, storage_key FROM folder_items WHERE id = ${id}
      UNION ALL
      SELECT c.id, c.storage_key FROM folder_items c JOIN subtree s ON c.parent_id = s.id
    )
    SELECT storage_key FROM subtree WHERE storage_key IS NOT NULL
  `);
  return (result.rows as { storage_key: string }[]).map((r) => r.storage_key);
}

// Rantai ancestor (id saja, tanpa item itu sendiri) — dipakai cek cycle saat move.
export async function ancestorIdsOf(id: number): Promise<number[]> {
  const result = await db().execute(sql<{ aid: number }>`
    WITH RECURSIVE ancestors AS (
      SELECT parent_id AS aid FROM folder_items WHERE id = ${id} AND parent_id IS NOT NULL
      UNION ALL
      SELECT f.parent_id FROM folder_items f JOIN ancestors a ON f.id = a.aid WHERE f.parent_id IS NOT NULL
    )
    SELECT aid FROM ancestors
  `);
  return (result.rows as { aid: number }[]).map((r) => r.aid);
}
