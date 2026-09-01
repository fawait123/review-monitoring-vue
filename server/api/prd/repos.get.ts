import { ensureGhAuthed, listAccessibleRepos } from "#server/services/prd/push";

export default defineEventHandler(async (event) => {
  try {
    await ensureGhAuthed();
    const repos = await listAccessibleRepos();
    return { repos };
  } catch (err: unknown) {
    setResponseStatus(event, 401);
    return { error: err instanceof Error ? err.message : String(err) };
  }
});
