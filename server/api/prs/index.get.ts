import { countPRs, listPRs } from "~~/server/services/db/prs";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const repo = typeof query.repo === "string" && query.repo !== "" ? query.repo : "all";
  const state = typeof query.state === "string" && query.state !== "" ? query.state : "all";
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

  const prs = await listPRs(
    repo === "all" ? undefined : repo,
    state === "all" ? undefined : state,
    pageSize,
    (page - 1) * pageSize,
  );
  const total = await countPRs(
    repo === "all" ? undefined : repo,
    state === "all" ? undefined : state,
  );

  return { prs, total, page, pageSize };
});
