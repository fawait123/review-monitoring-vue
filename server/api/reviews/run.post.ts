import { setResponseHeaders, setResponseStatus, readBody } from "h3";
import { getPRDiff, getPRDetail, getPRFull } from "../../services/github";
import { upsertRepo } from "../../services/db/repos";
import { getPRByKey, upsertPR } from "../../services/db/prs";
import { createReview, freshReview } from "../../services/db/reviews";
import { runReview } from "../../services/review/runner";
import { parseDiff, clampToHunkLine } from "~~/shared/diff-parser";
import type { DiffFile } from "~~/shared/types";

// Fungsi helper untuk memformat data SSE
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

  const repoRow = await upsertRepo(`${owner}/${repo}`);
  let pr = await getPRByKey(`${owner}/${repo}`, number);
  if (!pr) {
    const full = await getPRFull(owner, repo, number);
    await upsertPR({ repoId: repoRow.id, ...full });
    pr = (await getPRByKey(`${owner}/${repo}`, number))!;
  }

  await freshReview(pr.id)

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
  });

  let isAborted = false;
  const abortController = new AbortController()
  event.node.req.on("close", () => {
    isAborted = true;
    abortController.abort();
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: string, data: unknown) => {
        if (isAborted) return; // Stop jika sudah putus
        try {
          controller.enqueue(encoder.encode(sse(ev, data)));
        } catch (e) {
          isAborted = true; // Jika enqueue gagal, tandai abort
        }
      };

      let finalSummary = "";
      let allComments: any[] = [];
      let usedModel = "";


      try {
        const [diff, detail] = await Promise.all([
          getPRDiff(owner, repo, number),
          getPRDetail(owner, repo, number),
        ]);

        const files: DiffFile[] = parseDiff(diff);
        const clampLine = (path: string, line: number) => clampToHunkLine(files, path, line);

        send("diff", { size: diff.length, files: files.map((f) => f.path) });

        for (const file of files) {
          if (isAborted) break; // Hentikan loop jika koneksi terputus

          send("file_start", { path: file.path });

          const { result, model } = await runReview({
            diff,
            filePathTarget: file.path,
            owner,
            repo,
            number,
            title: detail.title,
            baseRef: detail.baseRefName,
            headRef: detail.headRefName,
            clampLine,
            cb: {
              onDelta: (t) => send("delta", { file: file.path, text: t }),
              onTool: (toolName, input, output, isError) =>
                send("tool", { file: file.path, toolName, input, output, isError }),
              onDone: (m) => send("model", { file: file.path, model: m }),
            },
            signal: abortController.signal
          });

          usedModel = model || usedModel;

          if (result.summary) {
            finalSummary += `\n\n### \`${file.path}\`\n${result.summary}`;
          }

          if (result.comments && result.comments.length > 0) {
            allComments = allComments.concat(result.comments);
          }

          send("file_done", { path: file.path });
        }

        if (!isAborted) {
          const aggregatedResult = {
            summary: finalSummary.trim() || "Tidak ada summary dari review.",
            comments: allComments
          };

          const review = await createReview(pr.id, aggregatedResult, usedModel);

          send("complete", {
            reviewId: review.id,
            summary: aggregatedResult.summary,
            comments: aggregatedResult.comments,
          });
        }

      } catch (err: any) {
        if (!isAborted) {
          const aggregatedResult = {
            summary: finalSummary.trim() || "Tidak ada summary dari review.",
            comments: allComments
          };

          const review = await createReview(pr.id, aggregatedResult, usedModel);

          send("error", {
            message: err.message ?? String(err),
            reviewId: review.id,
          });
        }
      } finally {
        if (!isAborted) {
          try {
            controller.close();
          } catch { }
        }
      }
    },
    cancel() {
      isAborted = true;
      abortController.abort();
    }
  });

  return stream;
});