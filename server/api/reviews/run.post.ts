import { getPRDiff, getPRDetail, getPRFull } from "../../services/github";
import { upsertRepo } from "../../services/db/repos";
import { getPRByKey, upsertPR } from "../../services/db/prs";
import { createReview } from "../../services/db/reviews";
import { runReview } from "../../services/review/runner";
import { parseDiff, clampToHunkLine } from "~~/shared/diff-parser";
import type { DiffFile } from "~~/shared/types";

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export default defineEventHandler(async (event) => {
  const { owner, repo, number } = (await readBody(event)) as {
    owner: string;
    repo: string;
    number: number;
  };
  if (!owner || !repo || !number) {
    setResponseStatus(event, 400);
    return { error: "body butuh {owner, repo, number}" };
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(ev, data)));
      const aborted = () => controller.error(new Error("aborted"));

      try {
        // pastikan repo + PR ada di DB (kalau belum ke-collect)
        const repoRow = await upsertRepo(`${owner}/${repo}`);
        let pr = await getPRByKey(`${owner}/${repo}`, number);
        if (!pr) {
          const full = await getPRFull(owner, repo, number);
          await upsertPR({ repoId: repoRow.id, ...full });
          pr = (await getPRByKey(`${owner}/${repo}`, number))!;
        }

        const [diff, detail] = await Promise.all([
          getPRDiff(owner, repo, number),
          getPRDetail(owner, repo, number),
        ]);
        const files: DiffFile[] = parseDiff(diff);
        const clampLine = (path: string, line: number) => clampToHunkLine(files, path, line);
        send("diff", { size: diff.length, files: files.map((f) => f.path) });

        const { result, model } = await runReview({
          diff,
          owner,
          repo,
          number,
          title: detail.title,
          baseRef: detail.baseRefName,
          headRef: detail.headRefName,
          clampLine,
          cb: {
            onDelta: (t) => send("delta", { text: t }),
            onTool: (toolName, input, output, isError) =>
              send("tool", { toolName, input, output, isError }),
            onDone: (m) => send("model", { model: m }),
          },
        });

        const review = await createReview(pr.id, result, model);
        send("complete", {
          reviewId: review.id,
          summary: result.summary,
          comments: result.comments,
        });
      } catch (err: any) {
        send("error", { message: err.message ?? String(err) });
      } finally {
        controller.close();
      }
    },
  });

  // abort kalau client putus koneksi
  event.node.res.on("close", () => stream.cancel());

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
