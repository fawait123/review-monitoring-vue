CREATE TABLE "prd_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"prd_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"acceptance_criteria" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"gh_issue_number" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prd_tasks_status_check" CHECK ("prd_tasks"."status" IN ('todo','in_progress','done'))
);
--> statement-breakpoint
CREATE TABLE "prds" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"prompt_input" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"repo_name_with_owner" text,
	"gh_pr_number" integer,
	"gh_pr_url" text,
	"generated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prds_status_check" CHECK ("prds"."status" IN ('draft','generated','pushed'))
);
--> statement-breakpoint
ALTER TABLE "prd_tasks" ADD CONSTRAINT "prd_tasks_prd_id_prds_id_fk" FOREIGN KEY ("prd_id") REFERENCES "public"."prds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_prd_tasks_prd" ON "prd_tasks" USING btree ("prd_id");