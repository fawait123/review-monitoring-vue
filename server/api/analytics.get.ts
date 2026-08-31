import { getAnalyticsData } from "../services/db/analytics";
import { getClickhouseAnalyticsData } from "../services/clickhouse/analytics";

// Data PR disinkron dari Postgres ke ClickHouse via PeerDB.
// Fallback ke Postgres jika env CLICKHOUSE_URL kosong (dev sebelum sync CH aktif).
export default defineEventHandler(async () => {
  const chUrl = process.env.CLICKHOUSE_URL;
  if (!chUrl) return getAnalyticsData();
  try {
    return await getClickhouseAnalyticsData();
  } catch (err: any) {
    return getAnalyticsData();
  }
});
