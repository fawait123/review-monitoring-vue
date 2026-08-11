import { execFileSync } from "node:child_process";
import { getGhStatus } from "../../services/ghAuth";

export default defineEventHandler(async (event) => {
  const status = await getGhStatus();
  if (!status.installed) {
    setResponseStatus(event, 500);
    return { error: "gh CLI tidak terpasang di server" };
  }
  if (!status.authenticated) {
    setResponseStatus(event, 409);
    return { error: "Tidak ada akun gh yang terhubung" };
  }
  try {
    // gh auth logout prompt konfirmasi di TTY; non-TTY perlu jawaban via stdin
    execFileSync("gh", ["auth", "logout", "-h", "github.com", "-u", status.login!], {
      input: "y\n",
      timeout: 15_000,
    });
    return { ok: true };
  } catch (err: any) {
    setResponseStatus(event, 500);
    return { error: `Logout gagal: ${err.message}` };
  }
});
