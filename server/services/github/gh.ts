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

export async function gh(args: string[]): Promise<string> {
  try {
    const { stdout } = await exec("gh", args, { maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  } catch (err: any) {
    throw new GhError(`gh ${args[0]} gagal: ${err.message}`, err.stderr ?? "");
  }
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
