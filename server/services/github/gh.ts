import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export class GhError extends Error {
  constructor(
    message: string,
    public stderr: string,
  ) {
    super(message);
    this.name = "GhError";
  }
  /** Pesan ringkas utk ditampilkan ke user, stderr disertakan bila ada. */
  friendlyMessage(): string {
    const err = this.stderr.trim();
    if (!err) return this.message;
    return `${this.message}: ${err.split("\n")[0] ?? err}`;
  }
}

const TRANSIENT_RE = /HTTP 50\d|HTTP 429|ETIMEDOUT|ECONNRESET|ECONNREFUSED|failed to (connect|reach)/;

// ponytail: retry 3x utk error transient (502 dari api.github.com/graphql sering terjadi
// saat collect banyak repo). gh() dipakai utk operasi read saja — aman di-retry;
// write (ghJson) sengaja tidak di-retry.
export async function gh(args: string[]): Promise<string> {
  let lastErr: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { stdout } = await exec("gh", args, { maxBuffer: 64 * 1024 * 1024 });
      return stdout;
    } catch (err: any) {
      lastErr = err;
      const detail = `${err.message ?? ""} ${err.stderr ?? ""}`;
      if (attempt === 3 || !TRANSIENT_RE.test(detail)) break;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  throw new GhError(`gh ${args[0]} gagal: ${lastErr.message}`, lastErr.stderr ?? "");
}

/** gh dgn raw JSON body via stdin (utk `--input -`). */
export async function ghJson(args: string[], body: unknown): Promise<string> {
  const child = spawn("gh", args, { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => (stdout += d));
  child.stderr.on("data", (d) => (stderr += d));
  child.stdin.end(JSON.stringify(body));
  return new Promise<string>((resolve, reject) => {
    child.on("error", (err) => reject(new GhError(`gh ${args[0]} gagal: ${err.message}`, stderr)));
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new GhError(`gh ${args[0]} gagal: (exit ${code})`, stderr));
    });
  });
}
