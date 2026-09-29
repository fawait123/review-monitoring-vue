import { readFile } from "node:fs/promises";
import type { ReviewResult } from "~~/shared/types";
import { clampToRange } from "~~/shared/diff-parser";
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
  /** Nomor baris new-side milik potongan diff yang sedang direview. Clamp dibatasi
   *  ke daftar ini supaya komentar tidak menempel ke baris di potongan lain. */
  hunkLines: number[];
  chunkInfo?: { index: number; total: number; lineStart?: number; lineEnd?: number };
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
    filePathTarget: opts.filePathTarget,
    chunkInfo: opts.chunkInfo
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

      const line = clampToRange(opts.hunkLines, c.line);
      if (line === null) continue; // di luar rentang potongan ini → drop
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

// ---------------------------------------------------------------------------
// Versi direct-API (nine-router / OpenAI-compatible), tanpa pi SDK.
// ---------------------------------------------------------------------------

interface NineRouterModels {
  providers?: Record<
    string,
    {
      baseUrl?: string;
      apiKey?: string;
      models?: { id: string; name?: string }[];
      /** Model cadangan, dipakai berurutan kalau model utama gagal/timeout. */
      fallbackModels?: string[];
    }
  >;
}

interface NineRouterTarget {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * Model yang TERBARU berhasil. Disimpan di level modul supaya file berikutnya dalam
 * run yang sama tidak mengulang 2 percobaan gagal ke model yang sudah diketahui mati.
 * ponytail: ini cache proses, jadi hilang saat restart — tidak apa-apa, fallback
 * akan menemukan ulang jalannya pada file pertama.
 */
let stickyModel: string | null = null;
/** Primary yang jadi asal stickyModel di atas — kalau primary berubah, cache dibuang. */
let stickyForPrimary: string | null = null;

/**
 * Susun RANTAI model: [model terpilih, ...fallback].
 * Model dipilih dari DB (halaman /model) kalau provider+model-nya valid, else model pertama.
 * Fallback di-skip kalau id-nya tidak terdaftar di models.json atau sudah dipakai.
 */
async function resolveNineRouterChain(): Promise<{ chain: NineRouterTarget[]; primary: string }> {
  const { configPaths } = await import("../model-config-paths");
  const { getModelConfig } = await import("../db/model-config");

  const { modelsPath } = configPaths();
  const parsed = JSON.parse(await readFile(modelsPath, "utf-8")) as NineRouterModels;
  const providers = parsed.providers ?? {};
  const providerIds = Object.keys(providers);
  if (providerIds.length === 0) throw new Error(`models.json tidak memuat provider: ${modelsPath}`);

  const cfg = await getModelConfig();
  const providerId =
    cfg && providers[cfg.providerId] ? cfg.providerId : providerIds[0]!;

  const provider = providers[providerId]!;
  const baseUrl = provider.baseUrl?.replace(/\/+$/, "");
  if (!baseUrl) throw new Error(`Provider "${providerId}" di models.json tidak punya baseUrl`);

  const known = new Set((provider.models ?? []).map((m) => m.id));
  const cfgValid = cfg && cfg.modelId && known.has(cfg.modelId);
  const primary = cfgValid ? cfg!.modelId : (provider.models ?? [])[0]?.id;
  if (!primary) throw new Error(`Provider "${providerId}" di models.json tidak punya model`);

  // Model yang tadi berhasil didahulukan, supaya file berikutnya tidak mengulang
  // 2 percobaan sia-sia ke model yang sudah mati. Dicocokkan ke primary asal: kalau
  // primary berganti (mis. diubah lewat halaman /model), cache lama harus dibuang —
  // kalau tidak, pilihan user diam-diam diabaikan selamanya.
  const ordered =
    stickyModel && stickyForPrimary === primary && known.has(stickyModel)
      ? [stickyModel, primary]
      : [primary];
  const chain = [...ordered, ...(provider.fallbackModels ?? [])].filter(
    (id, i, arr): id is string => known.has(id) && arr.indexOf(id) === i
  );

  // ponytail: API key dibaca polos dari models.json (file lokal, bukan secret store).
  // Kalau nine-router butuh rotasi key, pindahkan ke env di sini.
  return { chain: chain.map((model) => ({ providerId, baseUrl, apiKey: provider.apiKey ?? "", model })), primary };
}

/** POST /chat/completions (stream) → kumpulkan delta.content + kirim ke cb.onDelta. */
export async function streamChatCompletion(args: {
  target: NineRouterTarget;
  messages: { role: string; content: string }[];
  signal?: AbortSignal;
  onDelta: (text: string) => void;
  /** Batas tunggu token pertama. Default 300s — model legit-but-lambat (mis. geek/ggai) TTFB ~124s. */
  firstByteTimeoutMs?: number;
}): Promise<string> {
  const res = await fetch(`${args.target.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.target.apiKey}`,
    },
    body: JSON.stringify({
      model: args.target.model,
      messages: args.messages,
      stream: true,
      temperature: 0.2,
    }),
    signal: args.signal,
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 500);
    throw new Error(`Model API error: HTTP ${res.status} ${res.statusText} ${detail}`);
  }
  if (!res.body) throw new Error("Model API error: respons tanpa body (streaming tidak didukung)");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  // Timeout dipasang di SETIAP read, bukan hanya yang pertama. Upstream yang sudah
  // kirim header lalu diem (keepalive comment, kemudian hening) akan membuat read
  // kedua menggantung selamanya kalau hanya read pertama yang dijaga. 300s jauh di atas
  // jeda antar-token model lambat tapi sehat, jadi ini tidak menyakiti yang masih kerja.
  const waitMs = args.firstByteTimeoutMs ?? 300_000;
  const readNext = async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        reader.read(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            // WAJIB reject DULU, baru cancel. cancel() menyelesaikan read() yang
            // sedang jalan dengan {done:true} secara sinkron — kalau cancel lebih
            // dulu, Promise.race RESOLVE dan fungsi ini balik dengan string kosong
            // alih-alih melempar error.
            reject(
              new Error(
                `Model API error: tidak ada data baru dalam ${waitMs / 1000}s (gateway timeout)`
              )
            );
            void reader.cancel().catch(() => {});
          }, waitMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };

  for (;;) {
    const { done, value } = await readNext();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let content: string | undefined;
      let upstreamError: string | null = null;
      try {
        const json = JSON.parse(data) as {
          error?: { message?: string; code?: string };
          choices?: { delta?: { content?: string } }[];
        };
        // Router bisa balas HTTP 200 lalu error DI DALAM stream (mis. ggai: 124s lalu
        // gateway_timeout). Tanpa ini error-nya ditelan diam-diam dan muncul jauh
        // kemudian sebagai "output kosong" — nggak ketahuan modelnya yang bermasalah.
        if (json.error) {
          const msg = json.error.message ?? "unknown";
          upstreamError = json.error.code ? `${msg} (${json.error.code})` : msg;
        } else {
          content = json.choices?.[0]?.delta?.content;
        }
      } catch {
        continue; // chunk bukan JSON (keepalive/comment) — abaikan
      }
      if (upstreamError !== null) {
        await reader.cancel().catch(() => {});
        // Prefix "Model API error:" → isTransientError melihat kodenya (mis. gateway_timeout)
        // dan runner akan retry dengan backoff, atau lempar kalau bukan transient.
        throw new Error(`Model API error: ${upstreamError}`);
      }
      if (content) {
        full += content;
        args.onDelta(content);
      }
    }
  }
  return full;
}

export async function runReviewDirectApi(
  opts: RunOptions
): Promise<{ result: ReviewResult; model: string | null }> {
  const { REVIEW_SYSTEM_PROMPT, buildReviewUserPrompt } = await import("./prompt");
  const { chain, primary } = await resolveNineRouterChain();

  const userPrompt = buildReviewUserPrompt({
    owner: opts.owner,
    repo: opts.repo,
    number: opts.number,
    title: opts.title,
    baseRef: opts.baseRef,
    headRef: opts.headRef,
    diff: opts.diff,
    filePathTarget: opts.filePathTarget,
    chunkInfo: opts.chunkInfo,
  });
  const messages = [
    { role: "system", content: REVIEW_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  // Maks 2 percobaan per model; habis itu langsung pindah ke model fallback.
  const MAX_ATTEMPTS_PER_MODEL = 2;
  const failureLog: string[] = [];
  // Alasan model sebelumnya ditinggalkan, supaya event fallback bisa menyebut
  // penyebabnya (mis. "HTTP 400 Model is unavailable") dan bukan cuma "gagal".
  let lastFailure = "";

  for (let mi = 0; mi < chain.length; mi++) {
    const target = chain[mi]!;

    if (mi > 0) {
      opts.cb.onTool(
        "model_fallback",
        `Model "${chain[mi - 1]!.model}" gagal setelah ${MAX_ATTEMPTS_PER_MODEL} percobaan — ${lastFailure}. Beralih ke "${target.model}".`,
        "",
        false
      );
    }

    let text = "";
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt++) {
      if (opts.signal?.aborted) throw new Error("Review dibatalkan karena client disconnect.");
      try {
        text = await streamChatCompletion({
          target,
          messages,
          signal: opts.signal,
          onDelta: (t) => opts.cb.onDelta(t),
        });
        lastErr = null;
        break;
      } catch (err: unknown) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        failureLog.push(`${target.model}: ${msg}`);
        // Non-transient (mis. 400 "Model is unavailable") → retry cuma buang waktu, pindah model.
        // Transient tapi sudah percobaan terakhir → pindah model juga, jangan tunggu lagi.
        if (!isTransientError(err) || attempt === MAX_ATTEMPTS_PER_MODEL - 1) break;
        opts.cb.onTool(
          "api_retry",
          `Error transien (${msg}). Mencoba lagi (${attempt + 2}/${MAX_ATTEMPTS_PER_MODEL})...`,
          "",
          false
        );
        await delay(8000);
      }
    }
    if (lastErr) {
      lastFailure = lastErr instanceof Error ? lastErr.message : String(lastErr);
      continue; // model ini gagal → lanjut ke model fallback berikutnya
    }
    stickyModel = target.model; // model ini hidup → andalkan untuk file berikutnya
    stickyForPrimary = primary;
    if (opts.signal?.aborted) throw new Error("Review dibatalkan karena client disconnect.");

    let result: ReviewResult;
    try {
      result = parseReviewResult(text);
    } catch (firstErr: unknown) {
      // Error API (bukan format JSON) → lempar, biarkan caller per-file yang tangani.
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

      text = await streamChatCompletion({
        target,
        messages: [...messages, { role: "assistant", content: text }, { role: "user", content: retryInstruction }],
        signal: opts.signal,
        onDelta: (t) => opts.cb.onDelta(t),
      });

      try {
        result = parseReviewResult(text);
      } catch (secondErr: unknown) {
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

    // Validasi + clamp line ke hunk diff
    const clamped: ReviewResult["comments"] = [];
    for (const c of result.comments) {
      if (c.path !== opts.filePathTarget) continue; // abaikan komentar untuk file lain
      const line = clampToRange(opts.hunkLines, c.line);
      if (line === null) continue; // di luar rentang potongan ini → drop
      clamped.push({ ...c, line });
    }

    opts.cb.onDone(target.model);
    return { result: { summary: result.summary, comments: clamped }, model: target.model };
  }

  // Semua model di rantai gagal — sebut model mana yang bermasalah, jangan diam.
  throw new Error(
    `Semua model gagal merespons (rantai: ${chain.map((t) => t.model).join(" → ")}). Ringkasan: ${failureLog.join(" | ")}`
  );
}
