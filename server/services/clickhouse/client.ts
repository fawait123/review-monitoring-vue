import { createClient, type ClickHouseClient } from "@clickhouse/client";

// ponytail: connection lazy — dibuat saat query pertama, biar dev server tetap boot
// walau CLICKHOUSE_URL belum di-set (PeerDB sync ke CH baru aktif belakangan).
let _client: ClickHouseClient | null = null;

export function ch(): ClickHouseClient {
  if (!_client) {
    const url = process.env.CLICKHOUSE_URL || "http://localhost:8123";
    const username = process.env.CLICKHOUSE_USER || "default";
    const password = process.env.CLICKHOUSE_PASSWORD || "";
    _client = createClient({ url, username, password });
  }
  return _client;
}
