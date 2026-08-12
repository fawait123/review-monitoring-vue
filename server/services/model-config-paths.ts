/**
 * Resolve lokasi file config pi SDK (models.json + auth.json).
 * Dikenali beberapa lokasi runtime:
 *  - nitro prod / node-ESM: ../config relatif ke modul ini (server/services → server/config)
 *  - nitro dev (.nuxt): process.cwd()/server/config
 *  - Docker (.output): process.cwd().output/server/config (di-COPY dari server/config)
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function findConfigDir(): string {
  const candidates = [
    fileURLToPath(new URL("../config", import.meta.url)),
    resolve(process.cwd(), "server/config"),
    resolve(process.cwd(), ".output/server/config"),
  ];
  return candidates.find((dir) => existsSync(resolve(dir, "models.json"))) ?? candidates[0];
}

export function configPaths() {
  const dir = findConfigDir();
  return {
    modelsPath: resolve(dir, "models.json"),
    authPath: resolve(dir, "auth.json"),
  };
}