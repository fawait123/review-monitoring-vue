import type { H3Event } from "h3";
import { ancestorIdsOf, getItem, updateItem } from "#server/services/db/folder-items";

function bad(event: H3Event, status: number, error: string) {
  setResponseStatus(event, status);
  return { error };
}

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isInteger(id)) return bad(event, 400, "id tidak valid");

  const item = await getItem(id);
  if (!item) return bad(event, 404, "Item tak ditemukan");

  let body: unknown;
  try {
    body = await readBody(event);
  } catch {
    return bad(event, 400, "Body JSON tidak valid");
  }
  const b = body as { name?: unknown; url?: unknown; parentId?: unknown };

  const data: { name?: string; url?: string | null; parentId?: number | null } = {};

  if (b.name !== undefined) {
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return bad(event, 400, "name wajib diisi");
    if (name.length > 200) return bad(event, 400, "name maksimal 200 karakter");
    data.name = name;
  }

  if (b.url !== undefined) {
    if (item.kind !== "link") return bad(event, 400, "url hanya bisa diubah untuk link");
    const candidate = typeof b.url === "string" ? b.url.trim() : "";
    if (!/^https?:\/\//i.test(candidate)) {
      return bad(event, 400, "url link harus diawali http:// atau https://");
    }
    data.url = candidate;
  }

  if (b.parentId !== undefined) {
    let nextParentId: number | null = null;
    if (b.parentId !== null) {
      const pid = Number(b.parentId);
      if (!Number.isInteger(pid)) return bad(event, 400, "parentId tidak valid");
      if (pid === id) return bad(event, 400, "Tidak bisa memindahkan folder ke dalamnya sendiri");
      const parent = await getItem(pid);
      if (!parent) return bad(event, 404, "Target tidak ditemukan");
      if (parent.kind !== "folder") return bad(event, 400, "Target harus berupa folder");
      const ancestors = await ancestorIdsOf(pid);
      if (ancestors.includes(id)) {
        return bad(event, 400, "Tidak bisa memindahkan folder ke descendant-nya sendiri");
      }
      nextParentId = pid;
    }
    data.parentId = nextParentId;
  }

  if (Object.keys(data).length === 0) return bad(event, 400, "Tidak ada perubahan yang diminta");

  await updateItem(id, data);
  const fresh = await getItem(id);
  return { item: fresh };
});
