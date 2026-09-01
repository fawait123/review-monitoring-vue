import {
  getReview,
  listComments,
  markCommentSubmitted,
  markReviewSubmitted,
  updateComment,
} from "#server/services/db/reviews";
import { getPR } from "#server/services/db/prs";
import { getPRDetail, getPRDiff, submitReview } from "#server/services/github";
import { parseDiff, clampToHunkLine } from "~~/shared/diff-parser";

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
  if (comments.length === 0) {
    setResponseStatus(event, 400);
    return { error: "Tidak ada komentar untuk disubmit" };
  }

  try {
    // PR bisa berubah sejak review dibuat (force-push) → line komentar bisa tak ada di diff
    // lagi. Clamp ulang ke line diff terbaru (policy sama dgn runner); drop kalau file hilang
    // atau line melenceng jauh (komentar akan terpasang di konteks yang salah).
    const [detail, diff] = await Promise.all([
      getPRDetail(owner, repo, pr.number),
      getPRDiff(owner, repo, pr.number),
    ]);
    const files = parseDiff(diff);
    const payload: { id: number; path: string; line: number; side: "RIGHT"; body: string }[] = [];
    const dropped: string[] = [];
    for (const c of comments) {
      const line = clampToHunkLine(files, c.path, c.line);
      if (line === null) {
        dropped.push(`- **${c.path}** (file tak ada di diff terbaru)`);
        continue;
      }
      if (Math.abs(line - c.line) > 20) {
        dropped.push(`- **${c.path}:${c.line}** (line bergeser jauh ke ${line}, tak aman dipasang)`);
        continue;
      }
      if (line !== c.line) await updateComment(c.id, c.body, line, c.path);
      payload.push({ id: c.id, path: c.path, line, side: "RIGHT", body: c.body });
    }
    if (payload.length === 0) {
      setResponseStatus(event, 400);
      return { error: `Semua komentar tak bisa dipasang di diff terbaru:\n${dropped.join("\n")}` };
    }
    let summary = review.summary;
    if (dropped.length > 0) {
      summary = `${review.summary}\n\n> Komentar ini tak bisa dipasang (diff PR berubah sejak review dibuat):\n>\n${dropped.map((d) => `> ${d}`).join("\n")}`;
    }
    const ghComments = payload.map(({ id: _id, ...rest }) => rest);

    let ghReviewId: string;
    try {
      ghReviewId = await submitReview(
        owner, repo, pr.number, detail.headRefOid ?? null, summary, ghComments,
      );
    } catch (err: any) {
      // 422 masih mungkin untuk kasus edge lain → retry tanpa commit_id,
      // API apply ke commit terbaru, line diverifikasi GitHub.
      if (String(err.message).includes("422")) {
        ghReviewId = await submitReview(owner, repo, pr.number, null, summary, ghComments);
      } else {
        throw err;
      }
    }
    await markReviewSubmitted(review.id, ghReviewId);
    for (const c of payload) await markCommentSubmitted(c.id, ghReviewId);
    return { ghReviewId, comments: payload.length, dropped: dropped.length };
  } catch (err: any) {
    setResponseStatus(event, 500);
    return { error: err.message };
  }
});
