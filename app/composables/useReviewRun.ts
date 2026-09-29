import { toast } from "vue-sonner";
import type { PR, Review, ReviewComment } from "~~/shared/types";
import type { Ref } from "vue";
import type { ReviewMode, LogLine } from "./useReview";
import type { FileProgress } from "./useReviewState";

export function useReviewRun(options: {
  pr: PR;
  mode: Ref<ReviewMode>;
  activeReviewId: Ref<number | null>;
  summary: Ref<string>;
  comments: Ref<ReviewComment[]>;
  log: Ref<LogLine[]>;
  excludedPaths: Ref<string[]>;
  abortRef: Ref<AbortController | null>;
  pushLog: (line: LogLine) => void;
  fileProgress: Ref<Record<string, FileProgress>>;
  setFileProgress: (path: string, patch: FileProgress) => void;
}) {
  const {
    pr, mode, activeReviewId, summary, comments, log, excludedPaths, abortRef,
    pushLog, fileProgress, setFileProgress,
  } = options;

  const handleEvent = (event: string, data: Record<string, unknown>) => {
    switch (event) {
      case "delta": {
        const text = String(data.text ?? "");
        log.value = (() => {
          const last = log.value[log.value.length - 1];
          if (last?.kind === "text") {
            return [...log.value.slice(0, -1), { kind: "text", text: last.text + text }];
          }
          return [...log.value, { kind: "text", text }];
        })();
        break;
      }
      case "tool": {
        const name = String(data.toolName ?? "");
        const isError = Boolean(data.isError);
        // Event "error" detailnya ada di `output`, bukan `input` — kalau cuma baca
        // `input`, baris log jadi "⚠ tool error" tanpa jejanya.
        const detail = String(data.input ?? "") || String(data.output ?? "");
        // Baris normal boleh dipotong 120 char; error jangan — justru itu yang dicari.
        const shown = isError || name === "error" ? detail : detail.slice(0, 120);
        pushLog({
          kind: isError ? "error" : "tool",
          text: `${isError ? "✖" : "▶"} ${name}${shown ? `: ${shown}` : ""}`,
        });
        // Rentang baris dikirim sebagai field terpisah, bukan ditokenisasi dari
        // `input` — supaya UI bisa menandai baris tepat tanpa rapuh.
        if (name === "chunk" && data.file) {
          const path = String(data.file);
          const prev = fileProgress.value[path] ?? { status: "active" as const };
          const from = Number(data.lineStart);
          const to = Number(data.lineEnd);
          const spans = prev.spans?.map((s) => ({ ...s, active: false })) ?? [];
          if (Number.isFinite(from) && Number.isFinite(to) && to >= from) {
            spans.push({ from, to, active: true });
          }
          setFileProgress(path, {
            status: "active",
            chunk: data.chunk != null ? Number(data.chunk) : prev.chunk,
            total: data.total != null ? Number(data.total) : prev.total,
            spans,
          });
        }
        break;
      }
      case "diff": {
        const files = Array.isArray(data.files) ? data.files : [];
        const filesCount = files.length;
        const chunks = files.reduce(
          (a: number, f: { chunks?: number }) => a + (Number(f?.chunks) || 0),
          0,
        );
        pushLog({
          kind: "info",
          text:
            `Diff: ${Number(data.size ?? 0).toLocaleString()} bytes, ${filesCount} file` +
            (chunks > filesCount ? ` → ${chunks} bagian` : ""),
        });
        break;
      }
      case "model":
        pushLog({ kind: "info", text: `Model: ${String(data.model ?? "")}` });
        break;
      case "complete":
        pushLog({ kind: "info", text: `✅ Review selesai (id ${data.reviewId}). Memuat hasil…` });
        loadReview(Number(data.reviewId));
        break;
      case "file_start": {
        const path = String(data.path ?? "");
        setFileProgress(path, { status: "active", total: Number(data.chunks ?? 1), chunk: 0 });
        pushLog({ kind: "console", text: "==============================" });
        pushLog({ kind: "console", text: "============= START ==========" });
        pushLog({ kind: "console", text: "==============================" });
        pushLog({
          kind: "console",
          text: `Starting review file ${path}` +
            (Number(data.chunks ?? 1) > 1 ? ` (${Number(data.chunks)} bagian)` : ""),
        });
        break;
      }
      case "exclude_file": {
        setFileProgress(String(data.path ?? ""), { status: "skipped" });
        pushLog({ kind: "console", text: "==============================" });
        pushLog({ kind: "console", text: "=========== EXCLUDE ==========" });
        pushLog({ kind: "console", text: "==============================" });
        pushLog({ kind: "console", text: `Exclude review file ${String(data.path ?? "")}` });
        break;
      }
      case "file_done": {
        const path = String(data.path ?? "");
        // Jangan timpa status error: file yang gagal di tengah tetap harus ditandai merah.
        const prev = fileProgress.value[path];
        if (prev?.status !== "error") {
          setFileProgress(path, { ...prev, status: "done", spans: prev?.spans?.map((s) => ({ ...s, active: false })) });
        }
        pushLog({ kind: "console", text: `Finish review file ${path}` });
        break;
      }
      case "error": {
        // Event "error" tidak membawa path file. Tandai file yang lagi aktif supaya
        // sidebar diff menunjukkan file mana yang gagal, bukan semuanya diam saja.
        const active = Object.entries(fileProgress.value).find(([, p]) => p.status === "active");
        if (active) setFileProgress(active[0], { ...active[1], status: "error" });
        pushLog({ kind: "error", text: `❌ ${String(data.message ?? "")}` });
        toast.error(String(data.message ?? "Review gagal"));
        mode.value = "idle";
        if (data.reviewId) {
          loadReview(Number(data.reviewId));
        }
        break;
      }
    }
  };

  const loadReview = async (id: number) => {
    try {
      const data = await $fetch<{ review: Review; comments: ReviewComment[] }>(`/api/reviews/${id}`);
      activeReviewId.value = id;
      summary.value = data.review.summary;
      comments.value = data.comments;
      mode.value = "editing";
      toast.success("Review siap diedit");
    } catch {
      toast.error("Gagal memuat review");
      mode.value = "idle";
    }
  };

  const runReview = async () => {
    log.value = [];
    fileProgress.value = {};
    mode.value = "running";
    pushLog({ kind: "info", text: "Mengambil diff + menjalankan review via nine-router…" });

    const controller = new AbortController();
    abortRef.value = controller;

    const [owner, repo] = (pr.repo ?? "").split("/");

    try {
      const res = await fetch(`/api/reviews/run?pr=${pr.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          number: pr.number,
          excludeFiles: excludedPaths.value,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const event = block.match(/^event: (.+)$/m)?.[1] ?? "message";
          const dataMatch = block.replace(/^event: .+\n?/m, "").replace(/^data: /m, "");
          if (dataMatch.trim()) {
            const parsedData = JSON.parse(dataMatch);
            handleEvent(event, parsedData);
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        pushLog({ kind: "error", text: `❌ ${err.message}` });
        toast.error(err.message);
        mode.value = "idle";
      }
    }
  };

  const cancelRun = () => {
    abortRef.value?.abort();
    mode.value = "idle";
  };

  return { runReview, cancelRun, loadReview };
}
