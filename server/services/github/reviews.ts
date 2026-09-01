import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gh } from "./gh";

export interface SubmitComment {
  path: string;
  line: number;
  side: string;
  body: string;
}

export async function submitReview(
  owner: string,
  repo: string,
  number: number,
  commitId: string | null,
  summary: string,
  comments: SubmitComment[],
): Promise<string> {
  const body: Record<string, unknown> = {
    event: "COMMENT",
    body: summary,
    comments,
  };
  // commit_id kosong → biarkan API terapkan ke commit terbaru PR
  if (commitId) body.commit_id = commitId;
  // gh -f mengirim string → API butuh array JSON asli → tulis body ke file, pakai --input
  const tmp = path.join(os.tmpdir(), `review-${owner}-${repo}-${number}-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(body), "utf8");
  try {
    const out = await gh(["api", `repos/${owner}/${repo}/pulls/${number}/reviews`, "--input", tmp]);
    const parsed = JSON.parse(out) as { id: number };
    return String(parsed.id);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
