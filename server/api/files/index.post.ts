import type { H3Event } from "h3";
import { createItem, getItem } from "#server/services/db/folder-items";

function bad(event: H3Event, status: number, error: string) {
  setResponseStatus(event, status);
  return { error };
}

export default defineEventHandler(async (event) => {
  let body: unknown;
  try {
    body = await readBody(event);
  } catch {
    return bad(event, 400, "Body JSON tidak valid");
  }
  const b = body as { parentId?: unknown; kind?: unknown; name?: unknown; url?: unknown };

  const kind = b.kind;
  if (kind !== "folder" && kind !== "link") {
    return bad(event, 400, "kind harus 'folder' atau 'link' (file lewat endpoint upload)");
  }

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return bad(event, 400, "name wajib diisi");
  if (name.length > 200) return bad(event, 400, "name maksimal 200 karakter");

  const rawParent = b.parentId;
  let parentId: number | null = null;
  if (rawParent !== null && rawParent !== undefined) {
    const pid = Number(rawParent);
    if (!Number.isInteger(pid)) return bad(event, 400, "parentId tidak valid");
    const parent = await getItem(pid);
    if (!parent) return bad(event, 404, "Induk tidak ditemukan");
    if (parent.kind !== "folder") return bad(event, 400, "Hanya folder yang bisa menjadi induk");
    parentId = pid;
  }

  let url: string | null = null;
  if (kind === "link") {
    const candidate = typeof b.url === "string" ? b.url.trim() : "";
    if (!/^https?:\/\//i.test(candidate)) {
      return bad(event, 400, "url link harus diawali http:// atau https://");
    }
    url = candidate;
  }

  const item = await createItem({ parentId, kind, name, url });
  return { item };
});
