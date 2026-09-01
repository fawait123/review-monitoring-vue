import { createError } from "h3";
import { getPrd, listTasks, updatePrd } from "#server/services/db/prds";
import { pushPrdAsPr } from "#server/services/prd/push";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  const prd = await getPrd(id);
  if (!prd) {
    throw createError({ statusCode: 404, message: "PRD tak ditemukan" });
  }
  if (prd.status === "pushed") {
    throw createError({ statusCode: 409, message: "PRD sudah di-push" });
  }

  let body: unknown;
  try {
    body = await readBody(event);
  } catch {
    throw createError({ statusCode: 400, message: "Body JSON tidak valid" });
  }
  const b = body as { repo?: unknown };
  const repo = typeof b.repo === "string" && b.repo.trim() ? b.repo.trim() : prd.repoNameWithOwner;
  if (!repo) {
    throw createError({ statusCode: 400, message: "Repo wajib dipilih" });
  }

  try {
    const tasks = await listTasks(id);
    const { prNumber, prUrl } = await pushPrdAsPr(
      prd,
      tasks.map((t) => ({ title: t.title, description: t.description, acceptanceCriteria: t.acceptanceCriteria })),
      repo,
    );
    await updatePrd(id, { status: "pushed", repoNameWithOwner: repo, ghPrNumber: prNumber, ghPrUrl: prUrl });
    return { pr: { number: prNumber, url: prUrl }, taskCount: tasks.length };
  } catch (err: unknown) {
    const { GhError } = await import("#server/services/github/gh");
    const msg = err instanceof GhError ? err.friendlyMessage() : err instanceof Error ? err.message : String(err);
    throw createError({ statusCode: 400, message: msg });
  }
});
