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

/** Semua repo yang bisa diakses user (owner + collaborator + org member), exclude archived. */
export async function listAccessibleRepos(): Promise<string[]> {
  const names: string[] = [];
  let page = 1;
  for (;;) {
    const out = await gh([
      "api",
      `user/repos?affiliation=owner,collaborator,organization_member&per_page=100&page=${page}`,
      "--jq",
      ".[] | select(.archived == false) | .full_name",
    ]);
    const batch = out.split("\n").filter(Boolean);
    if (batch.length === 0) break;
    names.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return [...new Set(names)].sort();
}

export async function listPRs(repo: string, limit = 100): Promise<CollectedPR[]> {
  const out = await gh([
    "pr", "list", "-R", repo, "--state", "all", "--limit", String(limit),
    "--json", PR_JSON_FIELDS,
  ]);
  return (JSON.parse(out) as GhPRListItem[]).map((p) => ({
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
  }));
}

interface SearchPR {
  number: number;
  title: string;
  state: string;
  author: { login: string; name: string | null };
  repository: { nameWithOwner: string };
  url: string;
  createdAt: string;
  updatedAt: string;
  isDraft: boolean;
}

/** PR open milik user ATAU yang minta review ke user — 2 call, dedupe. */
export async function searchMyOpenPRs(): Promise<{ repo: string; pr: CollectedPR }[]> {
  // ponytail: gh search tak punya --page; --limit 1000 di-paginate internal oleh gh
  const queries = [
    ["search", "prs", "--author", "@me", "--state", "open", "--limit", "1000"],
    ["search", "prs", "--review-requested", "@me", "--state", "open", "--limit", "1000"],
  ];
  const seen = new Set<string>();
  const rows: SearchPR[] = [];
  for (const q of queries) {
    const out = await gh([
      ...q,
      "--json", "number,title,repository,url,author,state,createdAt,updatedAt,isDraft",
    ]);
    for (const r of JSON.parse(out) as SearchPR[]) {
      const key = `${r.repository.nameWithOwner}#${r.number}`;
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(r);
      }
    }
  }
  return rows.map((p) => ({
    repo: p.repository.nameWithOwner,
    pr: {
      number: p.number,
      title: p.title,
      authorLogin: p.author.login,
      authorName: p.author.name ?? null,
      state: p.state.toUpperCase() as CollectedPR["state"],
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      mergedAt: null,
      closedAt: null,
      url: p.url,
      // search API tak punya field ini — isi kosong/0, detail di-fetch saat buka PR
      headRefOid: "",
      isDraft: p.isDraft,
      additions: 0,
      deletions: 0,
      reviewDecision: null,
    },
  }));
}
