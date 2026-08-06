import { searchMyOpenPRs } from "../services/github";
import { upsertRepo } from "../services/db/repos";
import { upsertPR } from "../services/db/prs";

// ponytail: 1-2 call `gh search prs --author @me --state open` menggantikan 200 call per-repo.
export default defineEventHandler(async (event) => {
  const errors: string[] = [];
  try {
    const results = await searchMyOpenPRs();
    const repos = new Set<string>();
    let prCount = 0;
    for (const { repo, pr } of results) {
      repos.add(repo);
      const repoRow = await upsertRepo(repo);
      await upsertPR({ repoId: repoRow.id, ...pr });
      prCount++;
    }
    return { repos: repos.size, prs: prCount, skipped: 0, errors };
  } catch (err: any) {
    setResponseStatus(event, 500);
    return { error: `Collect gagal: ${err.message}` };
  }
});
