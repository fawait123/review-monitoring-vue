CREATE TABLE "model_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"provider_id" text NOT NULL,
	"model_id" text NOT NULL,
	"thinking_level" text DEFAULT 'medium' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_config_id_one" CHECK ("model_config"."id" = 1)
);
