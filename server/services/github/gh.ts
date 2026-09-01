import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export class GhError extends Error {
  constructor(message: string, public stderr: string) {
    super(message);
    this.name = "GhError";
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
