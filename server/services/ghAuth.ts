import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import type { ChildProcess } from "node:child_process";
import { createError } from "h3";

const exec = promisify(execFile);
const DEVICE_URL = "https://github.com/login/device";

export interface GhStatus {
  installed: boolean;
  authenticated: boolean;
  login: string | null;
}

/** Status auth gh: `gh auth status` exit code = source of truth. */
export async function getGhStatus(): Promise<GhStatus> {
  try {
    await exec("gh", ["--version"], { timeout: 5000 });
  } catch {
    return { installed: false, authenticated: false, login: null };
  }
  try {
    const { stdout, stderr } = await exec("gh", ["auth", "status"], { timeout: 10_000 });
    const m = (stdout + stderr).match(/Logged in to github\.com account (\S+)/);
    return { installed: true, authenticated: true, login: m?.[1] ?? null };
  } catch {
    return { installed: true, authenticated: false, login: null };
  }
}

// ponytail: satu login aktif per server (module singleton — Nitro bundle jadi satu modul).
let active: { proc: ChildProcess; code: string; timer: NodeJS.Timeout } | null = null;

/** Mulai device-flow login. Return kode sekali pakai untuk ditampilkan di UI. */
export async function startGhLogin(): Promise<{ code: string; url: string }> {
  const status = await getGhStatus();
  if (!status.installed) throw createError({ statusCode: 500, message: "gh CLI tidak terpasang di server" });
  if (status.authenticated) {
    throw createError({ statusCode: 409, message: `Sudah login sebagai @${status.login}` });
  }
  if (active) return { code: active.code, url: DEVICE_URL };

  const proc = spawn(
    "gh",
    ["auth", "login", "--hostname", "github.com", "--git-protocol", "https", "--web"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  const code = await new Promise<string>((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => {
      proc.kill();
      reject(createError({ statusCode: 500, message: "Gagal memulai login gh: timeout" }));
    }, 15_000);
    const onData = (d: Buffer) => {
      buf += d.toString();
      const m = buf.match(/one-time code: (\S+)/);
      if (m) {
        clearTimeout(timer);
        proc.stdout?.off("data", onData);
        proc.stderr?.off("data", onData);
        resolve(m[1] as string);
      }
    };
    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(createError({ statusCode: 500, message: `Gagal menjalankan gh: ${err.message}` }));
    });
  });

  // user tidak menyelesaikan login → bunuh setelah 10 menit
  const timer = setTimeout(() => cancelGhLogin(), 10 * 60 * 1000);
  active = { proc, code, timer };
  proc.on("exit", () => {
    if (active?.proc === proc) {
      clearTimeout(active.timer);
      active = null;
    }
  });
  return { code, url: DEVICE_URL };
}

/** Batalkan login yang sedang berjalan (kill child process). */
export function cancelGhLogin(): void {
  if (!active) return;
  clearTimeout(active.timer);
  active.proc.kill();
  active = null;
}
