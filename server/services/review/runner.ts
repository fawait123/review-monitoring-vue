import type { ReviewResult } from "~~/shared/types";

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

interface MessageContentPart {
  type?: string;
  text?: string;
}

interface AgentMessage {
  role?: string;
  content?: string | MessageContentPart[];
  text?: string;
  stopReason?: string;
  errorMessage?: string;
}

/**
 * Ekstrak teks terakhir dari assistant message.
 * Melempar error jika API mengembalikan stopReason=error (misal: 403, 429, 401).
 */
function lastAssistantText(messages: unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as AgentMessage | undefined;
    if (m?.role !== "assistant") continue;

    // Deteksi kegagalan API — jangan coba parse string kosong
    if (m.stopReason === "error" && m.errorMessage) {
      throw new Error(`Model API error: ${m.errorMessage}`);
    }

    const parts = m.content;
    if (Array.isArray(parts)) {
      const texts = parts
        .filter((p): p is MessageContentPart & { text: string } => p?.type === "text" && typeof p.text === "string")
        .map((p) => p.text);
      if (texts.length > 0) return texts.join("\n");
    }
    if (typeof m.text === "string" && m.text.length > 0) return m.text;
    // content ada tapi tidak ada teks — periksa apakah ada error tersembunyi
    if (m.stopReason === "error") {
      throw new Error("Model API mengembalikan respons kosong dengan stopReason=error");
    }
  }
  return "";
}

/** Bersihkan tag <think>...</think> dari model reasoning. */
function cleanText(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * Cek apakah error adalah error transien (rate limit, timeout, server busy)
 * yang layak untuk di-retry setelah beberapa saat.
 */
function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /403|429|rate.?limit|overload|reset after|503|timeout|ECONNRESET/i.test(msg);
}

/** Delay helper */
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Ekstrak dan parse JSON secara robust dari respons AI. */
function extractJson(text: string): unknown {
  const cleaned = cleanText(text);
  if (!cleaned) {
    throw new Error("Output teks dari asisten kosong");
  }

  // 1. Coba cari kurung kurawal terluar: dari '{' pertama hingga '}' terakhir
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  let candidate = cleaned;
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidate = cleaned.slice(firstBrace, lastBrace + 1);
  } else {
    // Coba ambil dari markdown code fences jika tidak ditemukan kurung kurawal terluar yang simetris
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch?.[1]) {
      candidate = fenceMatch[1].trim();
    }
  }

  // 2. Percobaan parsing utama
  try {
    return JSON.parse(candidate);
  } catch {
    // 3. Sanitasi trailing comma dan karakter kontrol tak valid
    try {
      const sanitized = candidate
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/[\u0000-\u001F]+/g, (m) => (m === "\n" || m === "\r" || m === "\t" ? m : ""));
      return JSON.parse(sanitized);
    } catch {
      // 4. Auto-repair untuk JSON yang terpotong karena batas token (unclosed quotes/brackets)
      try {
        let repaired = candidate;
        // Jika tanda kutip ganjil, tutup string
        if ((repaired.match(/"/g) || []).length % 2 !== 0) {
          repaired += '"';
        }
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/]/g) || []).length;
        for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";

        const openBraces = (repaired.match(/{/g) || []).length;
        const closeBraces = (repaired.match(/}/g) || []).length;
        for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";

        return JSON.parse(repaired);
      } catch (finalErr: unknown) {
        throw new Error(
          `Gagal mem-parse JSON hasil review: ${finalErr instanceof Error ? finalErr.message : String(finalErr)}`
        );
      }
    }
  }
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