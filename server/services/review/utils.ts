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
export function lastAssistantText(messages: unknown[]): string {
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
export function cleanText(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * Cek apakah error adalah error transien (rate limit, timeout, server busy)
 * yang layak untuk di-retry setelah beberapa saat.
 */
export function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /403|429|rate.?limit|overload|reset after|503|timeout|ECONNRESET/i.test(msg);
}

/** Delay helper */
export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Ekstrak dan parse JSON secara robust dari respons AI. */
export function extractJson(text: string): unknown {
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
