import { getPrd, replaceTasks, updatePrd } from "#server/services/db/prds";
import { breakdownTasks } from "#server/services/prd/generator";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  const prd = await getPrd(id);
  if (!prd) {
    setResponseStatus(event, 404);
    return { error: "PRD tak ditemukan" };
  }
  if (!prd.content.trim()) {
    setResponseStatus(event, 400);
    return { error: "PRD kosong — generate PRD dulu" };
  }

  const drafts = await breakdownTasks(prd.content);
  const tasks = await replaceTasks(id, drafts);
  await updatePrd(id, { status: "generated" });
  return { tasks };
});
