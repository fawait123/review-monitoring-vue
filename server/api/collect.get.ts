import { countPRs, listPRs } from "../services/db/prs";
import { listRepos } from "../services/db/repos";

export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  const repo = q.repo === "all" || !q.repo ? undefined : String(q.repo);
  const state = q.state === "all" || !q.state ? undefined : String(q.state);
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));
  const offset = (page - 1) * pageSize;

  const [prs, repos, total] = await Promise.all([
    listPRs(repo, state, pageSize, offset),
    listRepos(),
    countPRs(repo, state),
  ]);

  return {
    prs,
    repos: repos.map((r) => r.name_with_owner),
    total,
    page,
    pageSize,
  };
});
