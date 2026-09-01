import { getPrd, listTasks } from "#server/services/db/prds";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  const prd = await getPrd(id);
  if (!prd) {
    setResponseStatus(event, 404);
    return { error: "PRD tak ditemukan" };
  }
  const tasks = await listTasks(id);
  return { prd, tasks };
});
