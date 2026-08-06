CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer NOT NULL,
	"path" text NOT NULL,
	"line" integer NOT NULL,
	"side" text DEFAULT 'RIGHT' NOT NULL,
	"body" text NOT NULL,
	"position" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"gh_comment_id" text,
	CONSTRAINT "comments_status_check" CHECK ("comments"."status" IN ('draft','submitted'))
);
--> statement-breakpoint
CREATE TABLE "prs" (
	"id" serial PRIMARY KEY NOT NULL,
	"repo_id" integer NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"author_login" text NOT NULL,
	"author_name" text,
	"state" text NOT NULL,
	"is_draft" boolean DEFAULT false NOT NULL,
	"additions" integer DEFAULT 0 NOT NULL,
	"deletions" integer DEFAULT 0 NOT NULL,
	"review_decision" text,
	"head_ref_oid" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"merged_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "prs_state_check" CHECK ("prs"."state" IN ('OPEN','MERGED','CLOSED'))
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_with_owner" text NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_collected_at" timestamp with time zone,
	CONSTRAINT "repos_name_with_owner_unique" UNIQUE("name_with_owner")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"pr_id" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"pi_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"gh_review_id" text,
	CONSTRAINT "reviews_status_check" CHECK ("reviews"."status" IN ('draft','submitted'))
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prs" ADD CONSTRAINT "prs_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_pr_id_prs_id_fk" FOREIGN KEY ("pr_id") REFERENCES "public"."prs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_comments_review" ON "comments" USING btree ("review_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prs_repo_number_uq" ON "prs" USING btree ("repo_id","number");--> statement-breakpoint
CREATE INDEX "idx_prs_repo" ON "prs" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "idx_prs_state" ON "prs" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_reviews_pr" ON "reviews" USING btree ("pr_id");