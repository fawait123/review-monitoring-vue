import { listPRs, searchMyOpenPRs } from "#server/services/github";
import { upsertRepo } from "#server/services/db/repos";
import { upsertPR } from "#server/services/db/prs";

// ponytail: discovery 1-2 call `gh search prs` (repo target), lalu `gh pr list` per repo
// utk data lengkap — search API tak punya additions/deletions/reviewDecision (isi 0/null).
export default defineEventHandler(async (event) => {
  const errors: string[] = [];
  try {
    const results = await searchMyOpenPRs();
    const repos = [...new Set(results.map((r) => r.repo))];
    let prCount = 0;
    for (const repo of repos) {
      try {
        const repoRow = await upsertRepo(repo);
        const prs = await listPRs(repo, 100);
        for (const pr of prs) {
          await upsertPR({ repoId: repoRow.id, ...pr });
        }
        prCount += prs.length;
      } catch (err: any) {
        errors.push(`${repo}: ${err.message}`);
      }
    }
    return { repos: repos.length, prs: prCount, skipped: errors.length, errors };
  } catch (err: any) {
    setResponseStatus(event, 500);
    return { error: `Collect gagal: ${err.message}` };
  }
});
