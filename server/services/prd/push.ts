import { gh, ghJson } from "../github/gh";
import { getGhStatus } from "../ghAuth";
import { listAccessibleRepos } from "../github/repos";

export { listAccessibleRepos };

/** Guard: pastikan gh authenticated sebelum push. */
export async function ensureGhAuthed(): Promise<void> {
  const status = await getGhStatus();
  if (!status.installed) throw new Error("gh CLI tidak terpasang di server");
  if (!status.authenticated) throw new Error("Belum login ke GitHub — login dulu lewat halaman Status");
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "prd"
  );
}

interface TaskDoc {
  title: string;
  description: string;
  acceptanceCriteria: string;
}

/**
 * Bangun markdown terstruktur untuk task breakdown.
 * Format: YAML frontmatter (machine-readable) + sisa markdown checklist (human-readable).
 */
export function buildTasksMarkdown(prdTitle: string, tasks: TaskDoc[]): string {
  const front = [
    "---",
    `prd: ${JSON.stringify(prdTitle)}`,
    `task_count: ${tasks.length}`,
    "---",
    "",
  ].join("\n");

  const body = tasks
    .map((t, i) => {
      return [
        `## T${i + 1}. ${t.title}`,
        "",
        "### Deskripsi",
        t.description || "-",
        "",
        "### Acceptance Criteria",
        ...(t.acceptanceCriteria
          .split("\n")
          .filter((l) => l.trim())
          .map((l) => `- [ ] ${l}`)),
      ].join("\n");
    })
    .join("\n\n");
  return `${front}${body}\n`;
}

async function putFile(
  repo: string,
  branch: string,
  path: string,
  content: string,
  message: string,
): Promise<void> {
  const b64 = Buffer.from(content, "utf8").toString("base64");
  await gh([
    "api",
    `repos/${repo}/contents/${path}`,
    "-X", "PUT",
    "-f", `message=${message}`,
    "-f", `content=${b64}`,
    "-f", `branch=${branch}`,
  ]);
}

interface PrResult {
  prNumber: number;
  prUrl: string;
}

/** Repo kosong (belum ada commit/branch). Cisnakan initial commit sbg base. */
async function ensureRepoInit(repo: string): Promise<string> {
  const branch = "main";
  const treeSha = (
    await ghJson(
      ["api", `repos/${repo}/git/trees`, "--input", "-"],
      {
        tree: [
          { path: "README.md", mode: "100644", type: "blob", content: `# ${repo}\n` },
        ],
      },
    )
  ).trim();
  const tree = JSON.parse(treeSha) as { sha?: string };
  const commitSha = (
    await ghJson(
      ["api", `repos/${repo}/git/commits`, "--input", "-"],
      { message: "chore: initial commit", tree: tree.sha, parents: [] },
    )
  ).trim();
  const commit = JSON.parse(commitSha) as { sha?: string };
  await gh(["api", `repos/${repo}/git/refs`, "-f", `ref=refs/heads/${branch}`, "-f", `sha=${commit.sha}`]);
  return branch;
}

/**
 * Push PRD + task breakdown sbg structured files dalam folder docs/prd/
 * pada branch baru, jadi satu Pull Request.
 */
export async function pushPrdAsPr(
  prd: { title: string; content: string },
  tasks: TaskDoc[],
  repo: string,
): Promise<PrResult> {
  await ensureGhAuthed();

  let defaultBranch: string;
  try {
    const out = await gh(["repo", "view", repo, "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"]);
    defaultBranch = out.trim();
  } catch {
    // Repo tidak ditemukan / tak bisa dibuka / belum punya default branch.
    defaultBranch = "";
  }

  if (!defaultBranch) {
    // Repo kosong: bootstrap dulu dgn initial commit.
    defaultBranch = await ensureRepoInit(repo);
  }

  const sha = (await gh(["api", `repos/${repo}/git/ref/heads/${defaultBranch}`, "--jq", ".object.sha"])).trim();

  const slug = slugify(prd.title);
  const branch = `prd/${slug}-${Date.now()}`;
  await gh(["api", `repos/${repo}/git/refs`, "-f", `ref=refs/heads/${branch}`, "-f", `sha=${sha}`]);

  await putFile(repo, branch, `docs/prd/${slug}.md`, prd.content, `docs: add PRD ${prd.title}`);
  await putFile(repo, branch, `docs/prd/${slug}-tasks.md`, buildTasksMarkdown(prd.title, tasks), `docs: add task breakdown ${prd.title}`);

  const prBody = prd.content.length > 6000 ? `${prd.content.slice(0, 6000)}\n\n...` : prd.content;
  await gh([
    "pr", "create", "-R", repo,
    "--base", defaultBranch,
    "--head", branch,
    "--title", `[PRD] ${prd.title}`,
    "--body", prBody,
  ]);
  // gh pr create tdk dukung --json; query via pr view.
  const out = await gh(["pr", "view", branch, "-R", repo, "--json", "number,url", "--jq", "{number,url}"]);
  const parsed = JSON.parse(out) as { number: number; url: string };
  return { prNumber: parsed.number, prUrl: parsed.url };
}
