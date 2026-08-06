import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./server/services/db/schema.ts",
  out: "./server/services/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
