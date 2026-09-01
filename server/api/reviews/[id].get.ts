import { getReview, listComments, updateReviewSummary } from "#server/services/db/reviews";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  const review = await getReview(id);
  if (!review) {
    setResponseStatus(event, 404);
    return { error: "Review tak ditemukan" };
  }
  const comments = await listComments(review.id);
  return { review, comments };
});
