import { getPRByKey } from "../../../../services/db/prs";
import { listComments, listReviews } from "../../../../services/db/reviews";
import { getPRDetail, getPRDiff, getUserLogin } from "../../../../services/github";
import type { ReviewComment } from "~~/shared/types";

// Detail PR + semua review + komentar (opsional diff + branch refs utk halaman detail).
export default defineEventHandler(async (event) => {
  const owner = getRouterParam(event, "owner")!;
  const repo = getRouterParam(event, "repo")!;
  const num = Number(getRouterParam(event, "number"));
  if (!Number.isInteger(num)) {
    setResponseStatus(event, 400);
    return { error: "Nomor PR tidak valid" };
  }

  const pr = await getPRByKey(`${owner}/${repo}`, num);
  if (!pr) {
    setResponseStatus(event, 404);
    return { error: `PR ${owner}/${repo}#${num} belum ada di database — klik Refresh di dashboard` };
  }

  const includeDiff = getQuery(event).includeDiff === "1";

  const reviews = await listReviews(pr.id);
  const reviewsWithComments: { review: (typeof reviews)[number]; comments: ReviewComment[] }[] = [];
  for (const r of reviews) {
    reviewsWithComments.push({ review: r, comments: await listComments(r.id) });
  }

  let diff = "";
  let baseRef = "";
  let headRef = "";
  let diffError: string | null = null;
  if (includeDiff) {
    try {
      const [d, detail] = await Promise.all([
        getPRDiff(owner, repo, num),
        getPRDetail(owner, repo, num),
      ]);
      diff = d;
      baseRef = detail.baseRefName;
      headRef = detail.headRefName;
    } catch (err: any) {
      diffError = err.message;
    }
  }

  return {
    pr,
    reviews: reviewsWithComments,
    reviewerName: await getUserLogin(),
    diff: includeDiff ? diff : undefined,
    baseRef: includeDiff ? baseRef : undefined,
    headRef: includeDiff ? headRef : undefined,
    diffError,
  };
});
