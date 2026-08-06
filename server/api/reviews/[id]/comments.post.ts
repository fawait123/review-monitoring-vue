import { addComment, getReview } from "../../../services/db/reviews";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  const review = await getReview(id);
  if (!review) {
    setResponseStatus(event, 404);
    return { error: "Review tak ditemukan" };
  }
  if (review.status === "submitted") {
    setResponseStatus(event, 400);
    return { error: "Review sudah disubmit, tak bisa diubah" };
  }

  const { path, line, body } = (await readBody(event)) as {
    path: string;
    line: number;
    body: string;
  };
  if (!path || !line || !body?.trim()) {
    setResponseStatus(event, 400);
    return { error: "path, line, body wajib diisi" };
  }

  const comment = await addComment(review.id, path, line, body.trim());
  return { comment };
});
