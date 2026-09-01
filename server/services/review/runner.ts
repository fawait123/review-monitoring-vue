import type { ReviewResult } from "~~/shared/types";
import { lastAssistantText, cleanText, isTransientError, delay, extractJson } from "./utils";

export interface ReviewRunCallbacks {
  onDelta: (text: string) => void;
  onTool: (toolName: string, input: string, output: string, isError: boolean) => void;
  onDone: (model: string | null) => void;
}

interface RunOptions {
  diff: string;
  filePathTarget: string;
  owner: string;
  repo: string;
  number: number;
  title: string;
  baseRef: string;
  headRef: string;
  clampLine: (path: string, line: number) => number | null;
  cb: ReviewRunCallbacks;
  signal?: AbortSignal;
}

export function parseReviewResult(text: string): ReviewResult {
  const parsed = extractJson(text) as Record<string, unknown> | null;
  if (!parsed || typeof parsed !== "object") throw new Error("Output bukan JSON object");
  const summary = typeof parsed.summary === "string" ? parsed.summary : "";
  const comments = Array.isArray(parsed.comments)
    ? parsed.comments
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object" && typeof c.path === "string" && typeof c.body === "string")
      .map((c) => ({ path: String(c.path), line: Number(c.line) || 0, body: String(c.body) }))
    : [];
  return { summary, comments };
}

export async function runReview(
  opts: RunOptions
): Promise<{ result: ReviewResult; model: string | null }> {
  const pi = await import("@earendil-works/pi-coding-agent");
  const { REVIEW_SYSTEM_PROMPT, buildReviewUserPrompt } = await import("./prompt");
  const { configPaths } = await import("../model-config-paths");
  const { getModelConfig } = await import("../db/model-config");

  // Config pi SDK milik app sendiri (server/config/*) — tidak bergantung ~/.pi/agent.
  const { modelsPath, authPath } = configPaths();
  const modelRuntime = await pi.ModelRuntime.create({ modelsPath, authPath });

  // Model aktif dari config DB (diisi UI halaman /model); fallback model pertama available.
  const cfg = await getModelConfig();
  let model: unknown = undefined;
  let thinkingLevel: string | undefined = "medium";
  if (cfg) {
    const m = modelRuntime.getModel(cfg.providerId, cfg.modelId);
    if (m) {
      model = m;
      thinkingLevel = cfg.thinkingLevel;
    }
  }
  if (!model) {
    const available = await modelRuntime.getAvailable();
    if (available.length > 0) model = available[0];
  }

  const { session } = await pi.createAgentSession({
    modelRuntime,
    model: model as any,
    thinkingLevel: thinkingLevel as any,
    sessionManager: pi.SessionManager.inMemory(),
    tools: ["read", "grep", "find", "ls"],
    cwd: process.cwd(),
  });

  if (opts.signal) {
    opts.signal.addEventListener("abort", () => {
      // Jika user putus koneksi, buang session secara paksa agar proses AI terhenti
      session.dispose();
    });
  }

  let lastModel: string | null = null;
  session.subscribe((event: {
    type: string;
    assistantMessageEvent?: { type?: string; delta?: string };
    toolName?: string;
    input?: string;
    output?: string;
    isError?: boolean;
  }) => {
    switch (event.type) {
      case "message_update":
        if (event.assistantMessageEvent?.type === "text_delta" && event.assistantMessageEvent.delta) {
          opts.cb.onDelta(event.assistantMessageEvent.delta);
        }
        break;
      case "tool_execution_start":
        opts.cb.onTool(event.toolName ?? "unknown", event.input ?? "", "", false);
        break;
      case "tool_execution_end":
        opts.cb.onTool(event.toolName ?? "unknown", "", event.output ?? "", !!event.isError);
        break;
      case "agent_end":
        lastModel = session.model?.id ?? null;
        break;
    }
  });

  const userPrompt = buildReviewUserPrompt({
    owner: opts.owner,
    repo: opts.repo,
    number: opts.number,
    title: opts.title,
    baseRef: opts.baseRef,
    headRef: opts.headRef,
    diff: opts.diff,
    filePathTarget: opts.filePathTarget
  });

  // INJECT instruksi tambahan di akhir prompt agar AI benar-benar fokus pada 1 file ini
  const prompt = `${REVIEW_SYSTEM_PROMPT}\n\n${userPrompt}`;
  try {
    // Coba prompt dengan retry untuk error transien (rate limit, 403 reset, dll)
    let promptErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (opts.signal?.aborted) throw new Error("Review dibatalkan karena client disconnect.");
      try {
        await session.prompt(attempt === 0 ? prompt : prompt);
        promptErr = null;
        break;
      } catch (err: unknown) {
        promptErr = err;
        if (isTransientError(err) && attempt < 2) {
          const waitMs = (attempt + 1) * 8000; // 8s, 16s
          opts.cb.onTool(
            "api_retry",
            `Error transien (${err instanceof Error ? err.message : String(err)}). Menunggu ${waitMs / 1000}s lalu coba lagi (percobaan ${attempt + 2}/3)...`,
            "",
            false
          );
          await delay(waitMs);
          continue;
        }
        throw err;
      }
    }
    if (promptErr) throw promptErr;

    // lastAssistantText bisa melempar error jika API gagal (403, 429, dll)
    // — biarkan menyebar ke outer catch agar tertangani per-file.
    let text = lastAssistantText(session.agent.state.messages);
    let result: ReviewResult;
    try {
      result = parseReviewResult(text);
    } catch (firstErr: unknown) {
      // Jika error berasal dari API (bukan JSON format), langsung lempar ke outer catch
      if (firstErr instanceof Error && firstErr.message.startsWith("Model API error")) {
        throw firstErr;
      }

      opts.cb.onTool(
        "review_retry",
        `Output awal tidak valid JSON (${firstErr instanceof Error ? firstErr.message : ""}). Meminta AI memperbaiki output...`,
        "",
        false
      );

      const retryInstruction = `Output kamu sebelumnya tidak valid JSON atau terpotong. Tolong balas ULANG HANYA dengan SATU objek JSON valid untuk file \`${opts.filePathTarget}\` sesuai format skema {"summary": "...", "comments": [...]}. Jangan beri teks pengantar/penutup, jangan gunakan markdown code fence.`;

      await session.prompt(retryInstruction);

      // Bisa juga throw API error di sini
      text = lastAssistantText(session.agent.state.messages);
      try {
        result = parseReviewResult(text);
      } catch (secondErr: unknown) {
        // Fallback aman agar proses review PR tidak putus total
        opts.cb.onTool(
          "review_fallback",
          `Gagal memproses JSON setelah retry: ${secondErr instanceof Error ? secondErr.message : String(secondErr)}. Menggunakan fallback teks.`,
          "",
          true
        );
        result = {
          summary: text.trim()
            ? `*(Catatan: Format JSON tidak valid dari AI)*:\n\n${cleanText(text)}`
            : `*(AI tidak menghasilkan output review yang valid untuk file ini)*`,
          comments: [],
        };
      }
    }
    session.dispose();

    // validasi + clamp line ke hunk diff
    const clamped: ReviewResult["comments"] = [];
    for (const c of result.comments) {
      // PROTEKSI: Abaikan comment dari file lain jika LLM tergelincir berhalusinasi
      if (c.path !== opts.filePathTarget) continue;

      const line = opts.clampLine(c.path, c.line);
      if (line === null) continue; // file tak ada di diff → drop
      clamped.push({ ...c, line });
    }

    opts.cb.onDone(lastModel);
    return { result: { summary: result.summary, comments: clamped }, model: lastModel };
  } catch (error) {
    session.dispose();
    if (opts.signal?.aborted) {
      throw new Error("Review dibatalkan karena client disconnect.");
    }
    throw error;
  }
}
