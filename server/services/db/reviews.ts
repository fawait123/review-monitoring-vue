import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { comments, reviews } from "./schema";
import type { Review, ReviewComment, ReviewResult } from "~~/shared/types";

type ReviewRow = typeof reviews.$inferSelect;
type CommentRow = typeof comments.$inferSelect;

function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    prId: row.prId,
    status: row.status,
    summary: row.summary,
    piModel: row.piModel,
    createdAt: row.createdAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    ghReviewId: row.ghReviewId,
  };
}

function toComment(row: CommentRow): ReviewComment {
  return {
    id: row.id,
    reviewId: row.reviewId,
    path: row.path,
    line: row.line,
    side: row.side,
    body: row.body,
    position: row.position,
    status: row.status,
    ghCommentId: row.ghCommentId,
  };
}

export async function freshReview(prId: number) {
  return db().transaction(async (tx) => {
    const existing = await tx
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.prId, prId));

    const reviewIds = existing.map((r) => r.id);

    if (reviewIds.length > 0) {
      await tx.delete(comments).where(inArray(comments.reviewId, reviewIds));
      await tx.delete(reviews).where(inArray(reviews.id, reviewIds));
    }
  });
}

export async function createReview(
  prId: number,
  result: ReviewResult,
  piModel: string | null,
): Promise<Review> {
  return db().transaction(async (tx) => {
    const [review] = await tx
      .insert(reviews)
      .values({ prId, summary: result.summary, piModel })
      .returning();
    for (let i = 0; i < result.comments.length; i++) {
      const c = result.comments[i]!;
      await tx.insert(comments).values({
        reviewId: review!.id,
        path: c.path,
        line: c.line,
        side: "RIGHT",
        body: c.body,
        position: i,
      });
    }
    return toReview(review!);
  });
}

export async function getReview(id: number): Promise<Review | null> {
  const [row] = await db().select().from(reviews).where(eq(reviews.id, id)).limit(1);
  return row ? toReview(row) : null;
}

export async function listReviews(prId: number): Promise<Review[]> {
  const rows = await db().select().from(reviews).where(eq(reviews.prId, prId)).orderBy(desc(reviews.createdAt));
  return rows.map(toReview);
}

export async function updateReviewSummary(id: number, summary: string): Promise<void> {
  await db().update(reviews).set({ summary }).where(eq(reviews.id, id));
}

export async function markReviewSubmitted(id: number, ghReviewId: string): Promise<void> {
  await db()
    .update(reviews)
    .set({ status: "submitted", submittedAt: new Date(), ghReviewId })
    .where(eq(reviews.id, id));
}

export async function deleteReview(id: number): Promise<void> {
  await db().delete(reviews).where(eq(reviews.id, id));
}

export async function listComments(reviewId: number): Promise<ReviewComment[]> {
  const rows = await db()
    .select()
    .from(comments)
    .where(eq(comments.reviewId, reviewId))
    .orderBy(comments.position);
  return rows.map(toComment);
}

export async function getComment(id: number): Promise<ReviewComment | null> {
  const [row] = await db().select().from(comments).where(eq(comments.id, id)).limit(1);
  return row ? toComment(row) : null;
}

export async function updateComment(id: number, body: string, line: number, path: string): Promise<void> {
  await db().update(comments).set({ body, line, path }).where(eq(comments.id, id));
}

export async function deleteComment(id: number): Promise<void> {
  await db().delete(comments).where(eq(comments.id, id));
}

export async function addComment(
  reviewId: number,
  path: string,
  line: number,
  body: string,
): Promise<ReviewComment> {
  const [row] = await db()
    .insert(comments)
    .values({
      reviewId,
      path,
      line,
      side: "RIGHT",
      body,
      position: sql`(SELECT COALESCE(MAX(position), -1) + 1 FROM comments WHERE review_id = ${reviewId})`,
    })
    .returning();
  return toComment(row!);
}

export async function markCommentSubmitted(id: number, ghCommentId: string): Promise<void> {
  await db()
    .update(comments)
    .set({ status: "submitted", ghCommentId })
    .where(eq(comments.id, id));
}
