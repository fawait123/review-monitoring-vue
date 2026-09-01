import { resolve } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "#server/services/db/client";

// Jalankan migration saat boot — idempotent, aman di dev + docker.
export default defineNitroPlugin(async () => {
  if (!process.env.DATABASE_URL) return;
  try {
    await migrate(db(), {
      migrationsFolder: resolve(process.cwd(), "server/services/db/migrations"),
    });
    console.log("[db] migration ok");
  } catch (err: any) {
    console.error("[db] migration gagal:", err?.message ?? err);
  }
});
