import { getComment, getReview, updateComment } from "../../services/db/reviews";

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

  const { body, line, path } = (await readBody(event)) as {
    body?: string;
    line?: number;
    path?: string;
  };
  await updateComment(
    comment.id,
    body?.trim() || comment.body,
    line ?? comment.line,
    path ?? comment.path,
  );
  return { ok: true };
});
