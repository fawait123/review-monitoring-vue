import * as Minio from "minio";
import { randomUUID } from "node:crypto";

// ponytail: client lazy — dibuat saat operasi pertama, biar dev server tetap boot
// walau env MINIO_* belum di-set (user mengisi .env belakangan). Pola sama db/client.ts.
let _client: Minio.Client | null = null;
let _bucket: string | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} belum di-set di .env — isi dulu, lalu restart dev server`);
  return v;
}

export function minioClient(): Minio.Client {
  if (!_client) {
    _client = new Minio.Client({
      endPoint: requireEnv("MINIO_ENDPOINT"),
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: requireEnv("MINIO_ACCESS_KEY"),
      secretKey: requireEnv("MINIO_SECRET_KEY"),
      ...(process.env.MINIO_REGION ? { region: process.env.MINIO_REGION } : {}),
    });
    _bucket = requireEnv("MINIO_BUCKET");
  }
  return _client;
}

export function minioBucket(): string {
  minioClient();
  if (!_bucket) throw new Error("MINIO_BUCKET belum di-set di .env");
  return _bucket;
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const clean = base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  return clean || "file";
}

// Object key: files/<uuid>/<nama-sanitized> — uuid mencegah tabrakan nama.
export function newObjectKey(originalName: string): string {
  return `files/${randomUUID()}/${sanitizeFileName(originalName)}`;
}
