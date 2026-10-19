import { createItem, getItem } from "#server/services/db/folder-items";
import { minioBucket, minioClient, newObjectKey } from "#server/services/storage/minio";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export default defineEventHandler(async (event) => {
  let parts;
  try {
    parts = await readMultipartFormData(event);
  } catch {
    setResponseStatus(event, 400);
    return { error: "Form upload tidak valid" };
  }

  const filePart = parts?.find((p) => p.name === "file" && p.filename);
  if (!filePart?.data?.length) {
    setResponseStatus(event, 400);
    return { error: "File tidak ditemukan dalam form" };
  }
  if (filePart.data.length > MAX_UPLOAD_BYTES) {
    setResponseStatus(event, 400);
    return { error: "Ukuran file maksimal 50 MB" };
  }

  let parentId: number | null = null;
  const parentPart = parts?.find((p) => p.name === "parentId");
  if (parentPart?.data?.length) {
    const pid = Number(parentPart.data.toString("utf8"));
    if (!Number.isInteger(pid)) {
      setResponseStatus(event, 400);
      return { error: "parentId tidak valid" };
    }
    const parent = await getItem(pid);
    if (!parent) {
      setResponseStatus(event, 404);
      return { error: "Induk tidak ditemukan" };
    }
    if (parent.kind !== "folder") {
      setResponseStatus(event, 400);
      return { error: "Hanya folder yang bisa menjadi induk" };
    }
    parentId = pid;
  }

  const originalName = filePart.filename ?? "file";
  const contentType = filePart.type ?? "application/octet-stream";
  const key = newObjectKey(originalName);

  try {
    await minioClient().putObject(minioBucket(), key, filePart.data, filePart.data.length, {
      "Content-Type": contentType,
    });
  } catch (err: unknown) {
    setResponseStatus(event, 502);
    return { error: `Gagal menyimpan ke MinIO: ${err instanceof Error ? err.message : String(err)}` };
  }

  try {
    const item = await createItem({
      parentId,
      kind: "file",
      name: originalName,
      storageKey: key,
      originalName,
      fileSize: filePart.data.length,
      contentType,
    });
    return { item };
  } catch (err) {
    // rollback object agar tidak jadi yatim bila insert DB gagal
    await minioClient().removeObject(minioBucket(), key).catch(() => {});
    throw err;
  }
});
