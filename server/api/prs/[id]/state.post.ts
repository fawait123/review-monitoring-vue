import { getPR, updatePRState } from "#server/services/db/prs";
import type { PRState } from "~~/shared/types";

// Update state PR manual — hanya di database, tanpa sync GitHub.
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));

  let state: unknown;
  try {
    ({ state } = await readBody(event));
  } catch {
    setResponseStatus(event, 400);
    return { error: "Body JSON tidak valid" };
  }
  if (!["OPEN", "MERGED", "CLOSED"].includes(state as string)) {
    setResponseStatus(event, 400);
    return { error: "State harus OPEN, MERGED, atau CLOSED" };
  }
  const pr = await getPR(id);
  if (!pr) {
    setResponseStatus(event, 404);
    return { error: "PR tak ditemukan" };
  }

  await updatePRState(pr.id, state as PRState);
  return { ok: true, state };
});
