import { getTask, updateTask } from "#server/services/db/prds";

export default defineEventHandler(async (event) => {
  const taskId = Number(getRouterParam(event, "taskId"));
  const task = await getTask(taskId);
  if (!task) {
    setResponseStatus(event, 404);
    return { error: "Task tak ditemukan" };
  }

  let body: unknown;
  try {
    body = await readBody(event);
  } catch {
    setResponseStatus(event, 400);
    return { error: "Body JSON tidak valid" };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.title === "string" && b.title.trim()) await updateTask(taskId, { title: b.title.trim() });
  if (typeof b.description === "string") await updateTask(taskId, { description: b.description });
  if (typeof b.acceptanceCriteria === "string") await updateTask(taskId, { acceptanceCriteria: b.acceptanceCriteria });
  if (typeof b.status === "string" && ["todo", "in_progress", "done"].includes(b.status)) {
    await updateTask(taskId, { status: b.status as "todo" | "in_progress" | "done" });
  }
  return { ok: true };
});
