import { setResponseHeaders, setResponseStatus, readBody } from "h3";
import { getPRDiff, getPRDetail, getPRFull } from "#server/services/github";
import { upsertRepo } from "#server/services/db/repos";
import { getPRByKey, upsertPR } from "#server/services/db/prs";
import { createReview, freshReview } from "#server/services/db/reviews";
import { runReviewDirectApi } from "#server/services/review/runner";
import { parseDiff, chunkFileDiff, serializeHunks } from "~~/shared/diff-parser";
import type { DiffFile, ReviewResult } from "~~/shared/types";

// Fungsi helper untuk memformat data SSE
function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export default defineEventHandler(async (event) => {
  const { owner, repo, number, excludeFiles: rawExclude } = (await readBody(event)) as {
    owner: string;
    repo: string;
    number: number;
    // Field ini opsional: request tanpa `excludeFiles` harus tetap jalan, bukan 500.
    excludeFiles?: string[]
  };
  const excludeFiles = Array.isArray(rawExclude) ? rawExclude : [];

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

  await freshReview(pr.id);

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
  });

  let isAborted = false;
  const abortController = new AbortController();
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
        } catch {
          isAborted = true; // Jika enqueue gagal, tandai abort
        }
      };

      let finalSummary = "";
      let allComments: ReviewResult["comments"] = [];
      let usedModel = "";

      try {
        const [diff, detail] = await Promise.all([
          getPRDiff(owner, repo, number),
          getPRDetail(owner, repo, number),
        ]);

        const files: DiffFile[] = parseDiff(diff);

        send("diff", {
          size: diff.length,
          files: files.map((f) => ({ path: f.path, chunks: chunkFileDiff(f).length })),
        });

        for (const file of files) {
          if (isAborted) break; // Hentikan loop jika koneksi terputus

          if (excludeFiles.includes(file.path)) {
            send("exclude_file", { path: file.path })
            continue;
          }

          // Satu file dipecah per hunk supaya model tidak mengguess nomor baris di
          // tengah diff raksasa. Diff file lain tidak ikut dikirim sama sekali.
          const chunks = chunkFileDiff(file);
          send("file_start", { path: file.path, chunks: chunks.length });

          const parts: string[] = [];
          for (let i = 0; i < chunks.length; i++) {
            if (isAborted) break;
            const chunk = chunks[i]!;
            const chunkDiff = serializeHunks(file, chunk.hunks, chunk.budget);

            send("tool", {
              file: file.path,
              toolName: "chunk",
              input: `Bagian ${i + 1}/${chunks.length} · ${chunk.label} · ${(chunkDiff.length / 1024).toFixed(1)} KB`,
              output: "",
              isError: false,
              // Rentang baris dikirim terpisah (bukan cuma ditulis di `input`) supaya
              // client bisa menandai baris yang sedang direview tanpa parsing string.
              chunk: i + 1,
              total: chunks.length,
              lineStart: chunk.newLines[0] ?? null,
              lineEnd: chunk.newLines[chunk.newLines.length - 1] ?? null,
            });

            try {
              const { result, model } = await runReviewDirectApi({
                diff: chunkDiff,
                filePathTarget: file.path,
                hunkLines: chunk.newLines,
                chunkInfo: {
                  index: i + 1,
                  total: chunks.length,
                  lineStart: chunk.newLines[0],
                  lineEnd: chunk.newLines[chunk.newLines.length - 1],
                },
                owner,
                repo,
                number,
                title: detail.title,
                baseRef: detail.baseRefName,
                headRef: detail.headRefName,
                cb: {
                  onDelta: (t) => send("delta", { file: file.path, text: t }),
                  onTool: (toolName, input, output, isError) =>
                    send("tool", { file: file.path, toolName, input, output, isError }),
                  onDone: (m) => send("model", { file: file.path, model: m }),
                },
                signal: abortController.signal,
              });

              usedModel = model || usedModel;

              if (result.summary) {
                parts.push(chunks.length > 1 ? `**(${chunk.label})**\n${result.summary}` : result.summary);
              }

              if (result.comments && result.comments.length > 0) {
                allComments = allComments.concat(result.comments);
              }
            } catch (chunkErr: unknown) {
              if (isAborted) break;
              const errMsg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
              send("tool", {
                file: file.path,
                toolName: "error",
                input: `Bagian ${i + 1}/${chunks.length} (${chunk.label})`,
                output: `Gagal mereview bagian ini: ${errMsg}`,
                isError: true,
              });
              parts.push(`*(Catatan: bagian ${chunk.label} gagal direview: ${errMsg})*`);
            }
          }

          if (parts.length > 0) {
            finalSummary += `\n\n### \`${file.path}\`\n${parts.join("\n\n")}`;
          }

          send("file_done", { path: file.path });
        }

        if (!isAborted) {
          const aggregatedResult = {
            summary: finalSummary.trim() || "Tidak ada summary dari review.",
            comments: allComments,
          };

          const review = await createReview(pr!.id, aggregatedResult, usedModel);

          send("complete", {
            reviewId: review.id,
            summary: aggregatedResult.summary,
            comments: aggregatedResult.comments,
          });
        }
      } catch (err: unknown) {
        if (!isAborted) {
          const aggregatedResult = {
            summary: finalSummary.trim() || "Tidak ada summary dari review.",
            comments: allComments,
          };

          const review = await createReview(pr!.id, aggregatedResult, usedModel);

          send("error", {
            message: err instanceof Error ? err.message : String(err),
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
    },
  });

  return stream;
});