import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// ponytail: pool lazy — dibuat saat query pertama, biar dev server tetap boot
// walau DATABASE_URL belum di-set (user mengisi .env belakangan).
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL belum di-set di .env — isi dulu, lalu restart dev server");
    _db = drizzle(new Pool({ connectionString: url }), { schema });
  }
  return _db;
}
