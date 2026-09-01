import { getPrd, updatePrd, updateTask } from "#server/services/db/prds";
import type { PrdStatus, PrdTaskStatus } from "~~/shared/types";

const PRD_STATUS: PrdStatus[] = ["draft", "generated", "pushed"];
const TASK_STATUS: PrdTaskStatus[] = ["todo", "in_progress", "done"];

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  const prd = await getPrd(id);
  if (!prd) {
    setResponseStatus(event, 404);
    return { error: "PRD tak ditemukan" };
  }

  let body: unknown;
  try {
    body = await readBody(event);
  } catch {
    setResponseStatus(event, 400);
    return { error: "Body JSON tidak valid" };
  }
  const b = body as Record<string, unknown>;

  // Edit task via PUT /api/prd/tasks/:taskId — bukan di sini.
  if (typeof b.title === "string" && b.title.length > 0) await updatePrd(id, { title: b.title });
  if (typeof b.content === "string") await updatePrd(id, { content: b.content });
  if (typeof b.repoNameWithOwner === "string" || b.repoNameWithOwner === null) {
    await updatePrd(id, { repoNameWithOwner: b.repoNameWithOwner as string | null });
  }
  if (typeof b.status === "string" && PRD_STATUS.includes(b.status as PrdStatus)) {
    await updatePrd(id, { status: b.status as PrdStatus });
  }
  if (typeof b.taskStatus === "object" && b.taskStatus !== null) {
    for (const [taskIdStr, s] of Object.entries(b.taskStatus as Record<string, unknown>)) {
      if (TASK_STATUS.includes(s as PrdTaskStatus)) {
        await updateTask(Number(taskIdStr), { status: s as PrdTaskStatus });
      }
    }
  }
  const fresh = await getPrd(id);
  return { prd: fresh };
});
