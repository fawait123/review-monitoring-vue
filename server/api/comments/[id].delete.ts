import { deleteComment, getComment, getReview } from "#server/services/db/reviews";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  const comment = await getComment(id);
  if (!comment) {
    setResponseStatus(event, 404);
    return { error: "Comment tak ditemukan" };
  }
  const review = await getReview(comment.reviewId);
  if (review?.status === "submitted") {
    setResponseStatus(event, 400);
    return { error: "Review sudah disubmit" };
  }
  await deleteComment(comment.id);
  return { ok: true };
});
