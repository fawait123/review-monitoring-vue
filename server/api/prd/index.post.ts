import type { H3Event } from "h3";
import { generatePrdStream } from "#server/services/prd/generator";
import { createPrd } from "#server/services/db/prds";
import type { PrdStackInput } from "#server/services/prd/prompt";
import { PRD_STACK_FIELDS } from "#server/services/prd/prompt";

// ponytail: stream token via SSE (text/event-stream). Client baca pakai fetch + ReadableStream.

function writeSSE(event: H3Event, data: unknown): void {
  event.node.res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export default defineEventHandler(async (event) => {
  let body: unknown;
  try {
    body = await readBody(event);
  } catch {
    setResponseStatus(event, 400);
    return { error: "Body JSON tidak valid" };
  }
  const b = body as { prompt?: unknown; stack?: unknown };
  const prompt = b.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    setResponseStatus(event, 400);
    return { error: "prompt wajib diisi" };
  }
  // Validasi stack: map {frontend,backend,database,server} → nilai bebas (string)
  const raw = (b.stack ?? {}) as Record<string, unknown>;
  const stack: PrdStackInput = PRD_STACK_FIELDS.reduce<PrdStackInput>((acc, f) => {
    const v = raw[f];
    if (typeof v === "string" && v.trim()) acc[f] = v.trim();
    return acc;
  }, {});

  const res = event.node.res;
  setResponseStatus(event, 200);
  setHeader(event, "Content-Type", "text/event-stream; charset=utf-8");
  setHeader(event, "Cache-Control", "no-cache");
  setHeader(event, "Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const full = await generatePrdStream(prompt.trim(), stack, (delta) => {
      writeSSE(event, { type: "delta", text: delta });
    });

    const prd = await createPrd({ title: full.title, promptInput: prompt.trim(), content: full.content, generatedBy: full.model });
    writeSSE(event, { type: "done", prd });
    res.end();
  } catch (err: unknown) {
    writeSSE(event, { type: "error", error: err instanceof Error ? err.message : String(err) });
    res.end();
  }
});
