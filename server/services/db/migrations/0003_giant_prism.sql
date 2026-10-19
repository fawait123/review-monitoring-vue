CREATE TABLE "folder_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"storage_key" text,
	"original_name" text,
	"file_size" integer,
	"content_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "folder_items_kind_check" CHECK ("folder_items"."kind" IN ('folder','link','file')),
	CONSTRAINT "folder_items_link_url_check" CHECK ("folder_items"."kind" <> 'link' OR "folder_items"."url" IS NOT NULL),
	CONSTRAINT "folder_items_file_key_check" CHECK ("folder_items"."kind" <> 'file' OR "folder_items"."storage_key" IS NOT NULL),
	CONSTRAINT "folder_items_folder_null_check" CHECK ("folder_items"."kind" <> 'folder' OR ("folder_items"."url" IS NULL AND "folder_items"."storage_key" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "folder_items" ADD CONSTRAINT "folder_items_parent_id_folder_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folder_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_folder_items_parent" ON "folder_items" USING btree ("parent_id");