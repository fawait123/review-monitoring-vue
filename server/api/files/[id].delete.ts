import { deleteItem, fileKeysInSubtree, getItem } from "#server/services/db/folder-items";
import { minioBucket, minioClient } from "#server/services/storage/minio";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isInteger(id)) {
    setResponseStatus(event, 400);
    return { error: "id tidak valid" };
  }

  const item = await getItem(id);
  if (!item) {
    setResponseStatus(event, 404);
    return { error: "Item tak ditemukan" };
  }

  const keys = await fileKeysInSubtree(id);
  await deleteItem(id); // FK cascade menghapus seluruh subtree

  // Sweep object MinIO best-effort — DB tetap source of truth.
  for (const key of keys) {
    await minioClient().removeObject(minioBucket(), key).catch((err: unknown) => {
      console.warn(`[files] gagal hapus object MinIO ${key}:`, err instanceof Error ? err.message : err);
    });
  }

  return { ok: true };
});
