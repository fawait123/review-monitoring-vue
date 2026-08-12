import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { PRState, ReviewStatus, CommentStatus } from "~~/shared/types";

export const repos = pgTable(
  "repos",
  {
    id: serial("id").primaryKey(),
    nameWithOwner: text("name_with_owner").notNull().unique(),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
    lastCollectedAt: timestamp("last_collected_at", { withTimezone: true }),
  },
);

export const prs = pgTable(
  "prs",
  {
    id: serial("id").primaryKey(),
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    authorLogin: text("author_login").notNull(),
    authorName: text("author_name"),
    state: text("state").notNull().$type<PRState>(),
    isDraft: boolean("is_draft").notNull().default(false),
    additions: integer("additions").notNull().default(0),
    deletions: integer("deletions").notNull().default(0),
    reviewDecision: text("review_decision"),
    headRefOid: text("head_ref_oid").notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    mergedAt: timestamp("merged_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("prs_repo_number_uq").on(t.repoId, t.number),
    index("idx_prs_repo").on(t.repoId),
    index("idx_prs_state").on(t.state),
    check("prs_state_check", sql`${t.state} IN ('OPEN','MERGED','CLOSED')`),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    prId: integer("pr_id")
      .notNull()
      .references(() => prs.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("draft").$type<ReviewStatus>(),
    summary: text("summary").notNull().default(""),
    piModel: text("pi_model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    ghReviewId: text("gh_review_id"),
  },
  (t) => [
    index("idx_reviews_pr").on(t.prId),
    check("reviews_status_check", sql`${t.status} IN ('draft','submitted')`),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    reviewId: integer("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    line: integer("line").notNull(),
    side: text("side").notNull().default("RIGHT"),
    body: text("body").notNull(),
    position: integer("position").notNull(),
    status: text("status").notNull().default("draft").$type<CommentStatus>(),
    ghCommentId: text("gh_comment_id"),
  },
  (t) => [
    index("idx_comments_review").on(t.reviewId),
    check("comments_status_check", sql`${t.status} IN ('draft','submitted')`),
  ],
);

// Konfigurasi model pi SDK untuk review — single row (id selalu 1).
// Diisi dari UI halaman /model; dibaca runner tiap kali review dijalankan.
export const modelConfig = pgTable(
  "model_config",
  {
    id: serial("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),
    thinkingLevel: text("thinking_level").notNull().default("medium"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("model_config_id_one", sql`${t.id} = 1`)],
);
