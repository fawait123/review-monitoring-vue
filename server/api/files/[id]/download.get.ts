import { getDownloadSource } from "#server/services/db/folder-items";
import { minioBucket, minioClient, sanitizeFileName } from "#server/services/storage/minio";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isInteger(id)) {
    setResponseStatus(event, 400);
    return { error: "id tidak valid" };
  }

  const item = await getDownloadSource(id);
  if (!item) {
    setResponseStatus(event, 404);
    return { error: "Item tak ditemukan" };
  }
  if (item.kind !== "file" || !item.storageKey) {
    setResponseStatus(event, 400);
    return { error: "Hanya file yang bisa diunduh" };
  }

  try {
    const inline = getQuery(event).inline === "1";
    const stream = await minioClient().getObject(minioBucket(), item.storageKey);
    setHeader(event, "content-type", item.contentType ?? "application/octet-stream");
    setHeader(
      event,
      "content-disposition",
      `${inline ? "inline" : "attachment"}; filename="${sanitizeFileName(item.originalName ?? item.name)}"`,
    );
    if (item.fileSize) setHeader(event, "content-length", item.fileSize);
    return stream;
  } catch (err: unknown) {
    setResponseStatus(event, 502);
    return { error: `Gagal membaca file dari MinIO: ${err instanceof Error ? err.message : String(err)}` };
  }
});
