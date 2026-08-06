import {
  getReview,
  listComments,
  markCommentSubmitted,
  markReviewSubmitted,
} from "../../../services/db/reviews";
import { getPR } from "../../../services/db/prs";
import { getPRDetail, submitReview } from "../../../services/github";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  const review = await getReview(id);
  if (!review) {
    setResponseStatus(event, 404);
    return { error: "Review tak ditemukan" };
  }
  if (review.status === "submitted") {
    setResponseStatus(event, 400);
    return { error: "Review sudah disubmit" };
  }

  const pr = await getPR(review.prId);
  if (!pr || !pr.repo) {
    setResponseStatus(event, 404);
    return { error: "PR tak ditemukan" };
  }
  const [owner = "", repo = ""] = pr.repo.split("/");
  if (!owner || !repo) {
    setResponseStatus(event, 400);
    return { error: "Repo format tak valid" };
  }

  const comments = (await listComments(review.id)).filter((c) => c.body.trim());
  const payload = comments.map((c) => ({
    path: c.path,
    line: c.line,
    side: c.side as "RIGHT",
    body: c.body,
  }));

  try {
    // headRefOid di DB bisa stale (PR update/force-push sejak collect) → fetch SHA terbaru
    const detail = await getPRDetail(owner, repo, pr.number);
    let ghReviewId: string;
    try {
      ghReviewId = await submitReview(
        owner, repo, pr.number, detail.headRefOid ?? null, review.summary, payload,
      );
    } catch (err: any) {
      // 422 masih mungkin: line komentar tak ada di diff commit terbaru (PR diubah).
      // Retry tanpa commit_id → API apply ke commit terbaru, line diverifikasi GitHub.
      if (String(err.message).includes("422")) {
        ghReviewId = await submitReview(owner, repo, pr.number, null, review.summary, payload);
      } else {
        throw err;
      }
    }
    await markReviewSubmitted(review.id, ghReviewId);
    for (const c of comments) await markCommentSubmitted(c.id, ghReviewId);
    return { ghReviewId, comments: comments.length };
  } catch (err: any) {
    setResponseStatus(event, 500);
    return { error: err.message };
  }
});
