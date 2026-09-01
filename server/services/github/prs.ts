import type { CollectedPR } from "~~/shared/types";
import { gh } from "./gh";

interface GhPRListItem {
  number: number;
  title: string;
  author: { login: string; name?: string | null };
  state: "OPEN" | "MERGED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  url: string;
  headRefOid: string;
  isDraft: boolean;
  additions: number;
  deletions: number;
  reviewDecision: string | null;
}

const PR_JSON_FIELDS =
  "number,title,author,state,createdAt,mergedAt,closedAt,updatedAt,url,headRefOid,isDraft,additions,deletions,reviewDecision";

export async function getPRDetail(
  owner: string,
  repo: string,
  number: number,
): Promise<{
  headRefOid: string;
  title: string;
  body: string;
  state: string;
  baseRefName: string;
  headRefName: string;
}> {
  const out = await gh([
    "pr", "view", "-R", `${owner}/${repo}`, String(number),
    "--json", "headRefOid,title,body,state,baseRefName,headRefName",
  ]);
  return JSON.parse(out);
}

/** Satu PR lengkap (shape sama dgn listPRs) — dipakai utk ensure PR ada di DB. */
export async function getPRFull(owner: string, repo: string, number: number): Promise<CollectedPR> {
  const out = await gh([
    "pr", "view", "-R", `${owner}/${repo}`, String(number),
    "--json", PR_JSON_FIELDS,
  ]);
  const p = JSON.parse(out) as GhPRListItem;
  return {
    number: p.number,
    title: p.title,
    authorLogin: p.author.login,
    authorName: p.author.name ?? null,
    state: p.state,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    mergedAt: p.mergedAt,
    closedAt: p.closedAt,
    url: p.url,
    headRefOid: p.headRefOid,
    isDraft: p.isDraft,
    additions: p.additions,
    deletions: p.deletions,
    reviewDecision: p.reviewDecision,
  };
}

export async function getUserLogin(): Promise<string> {
  try {
    const out = await gh(["api", "user", "--jq", ".login"]);
    return out.trim() || "Anda";
  } catch {
    return "Anda";
  }
}

export async function getPRDiff(owner: string, repo: string, number: number): Promise<string> {
  try {
    return await gh(["pr", "diff", "-R", `${owner}/${repo}`, String(number)]);
  } catch (err) {
    // PR >300 file → GitHub tolak diff (HTTP 406 "exceeded the maximum number of files").
    // Fallback: files API paginated, rakit ulang unified diff dari tiap .patch.
    try {
      return await gh([
        "api", `repos/${owner}/${repo}/pulls/${number}/files`,
        "--paginate", "--jq",
        '.[] | "diff --git a/" + .filename + " b/" + .filename + "\n"' +
          '+ (if .status == "added" then "new file mode 100644\n"' +
          ' elif .status == "removed" then "deleted file mode 100644\n" else "" end)' +
          '+ "--- a/" + .filename + "\n+++ b/" + .filename + "\n" + (.patch // "")',
      ]);
    } catch {
      throw err; // error asli kalau fallback juga gagal
    }
  }
}
