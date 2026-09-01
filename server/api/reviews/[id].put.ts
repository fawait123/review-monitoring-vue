import { getReview, updateReviewSummary } from "#server/services/db/reviews";

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

  let summary: unknown;
  try {
    ({ summary } = await readBody(event));
  } catch {
    setResponseStatus(event, 400);
    return { error: "Body JSON tidak valid" };
  }
  if (typeof summary !== "string") {
    setResponseStatus(event, 400);
    return { error: "summary wajib string" };
  }
  await updateReviewSummary(review.id, summary.trim());
  return { ok: true };
});
