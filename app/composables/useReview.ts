import { ref } from "vue";
import { toast } from "vue-sonner";
import type { PR, Review, ReviewComment } from "~~/shared/types";

export type ReviewMode = "idle" | "running" | "editing" | "submitted";

export interface LogLine {
  kind: "info" | "tool" | "text" | "console";
  text: string;
}

export function useReview(options: {
  pr: PR;
  reviews: Review[];
  commentsByReview: Record<number, ReviewComment[]>;
  onSubmitted?: () => void;
}) {
  const { pr, reviews, commentsByReview, onSubmitted } = options;

  const draft = reviews.find((r) => r.status === "draft");
  const submittedReviews = reviews.filter((r) => r.status === "submitted");

  const mode = ref<ReviewMode>(submittedReviews.length > 0 ? "submitted" : draft ? "editing" : "idle");
  const activeReviewId = ref<number | null>(draft?.id ?? null);
  const summary = ref<string>(draft?.summary ?? submittedReviews[0]?.summary ?? "");
  const comments = ref<ReviewComment[]>(activeReviewId.value ? commentsByReview[activeReviewId.value] ?? [] : []);
  const log = ref<LogLine[]>([]);
  const editingId = ref<number | null>(null);
  const editBody = ref("");
  const openThread = ref<{ path: string; line: number } | null>(null);
  const submitting = ref(false);
  const abortRef = ref<AbortController | null>(null);
  const excludedPaths = ref<string[]>([])

  const pushLog = (line: LogLine) => {
    log.value = [...log.value, line];
  };

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
        const inputStr = data.input ? `: ${String(data.input).slice(0, 120)}` : "";
        pushLog({
          kind: "tool",
          text: `${data.isError ? "⚠" : "▶"} tool ${String(data.toolName ?? "")}${inputStr}`,
        });
        break;
      }
      case "diff": {
        const filesCount = Array.isArray(data.files) ? data.files.length : 0;
        pushLog({
          kind: "info",
          text: `Diff: ${Number(data.size ?? 0).toLocaleString()} bytes, ${filesCount} file`,
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
      case "file_start":
        pushLog({ kind: "console", text: "==============================" });
        pushLog({ kind: "console", text: "============= START ==========" });
        pushLog({ kind: "console", text: "==============================" });
        pushLog({ kind: "console", text: `Starting review file ${String(data.path ?? "")}` });
        break;
      case "exclude_file":
        pushLog({ kind: "console", text: "==============================" });
        pushLog({ kind: "console", text: "=========== EXCLUDE ==========" });
        pushLog({ kind: "console", text: "==============================" });
        pushLog({ kind: "console", text: `Exclude review file ${String(data.path ?? "")}` });
        break;
      case "file_done":
        pushLog({ kind: "console", text: `Finish review file ${String(data.path ?? "")}` });
        break;
      case "error":
        pushLog({ kind: "info", text: `❌ ${String(data.message ?? "")}` });
        toast.error(String(data.message ?? "Review gagal"));
        mode.value = "idle";
        if (data.reviewId) {
          loadReview(Number(data.reviewId));
        }
        break;
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
    mode.value = "running";
    pushLog({ kind: "info", text: "Mengambil diff + menjalankan Pi agent…" });

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
          excludeFiles: excludedPaths.value
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

      for (; ;) {
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
        pushLog({ kind: "info", text: `❌ ${err.message}` });
        toast.error(err.message);
        mode.value = "idle";
      }
    }
  };

  const cancelRun = () => {
    abortRef.value?.abort();
    mode.value = "idle";
  };

  const toggleExclude = (path: string, checked: boolean) => {
    if (checked) {
      if (!excludedPaths.value.includes(path)) {
        excludedPaths.value.push(path)
      }
    } else {
      excludedPaths.value = excludedPaths.value.filter(p => p !== path)
    }
  }

  const totalExclude = computed(() => excludedPaths.value.length)

  const addComment = async (path: string, line: number, body: string) => {
    if (!activeReviewId.value) return;
    try {
      const data = await $fetch<{ comment: ReviewComment }>(`/api/reviews/${activeReviewId.value}/comments`, {
        method: "POST",
        body: { path, line, body },
      });
      comments.value = [...comments.value, data.comment];
      toast.success("Komentar ditambahkan");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal tambah komentar";
      toast.error(msg);
      throw err;
    }
  };

  const startEditComment = (c: ReviewComment) => {
    editingId.value = c.id;
    editBody.value = c.body;
    openThread.value = { path: c.path, line: c.line };
  };

  const cancelEditComment = () => {
    editingId.value = null;
    editBody.value = "";
  };

  const saveEdit = async (c: ReviewComment) => {
    try {
      await $fetch(`/api/comments/${c.id}`, {
        method: "PUT",
        body: { body: editBody.value },
      });
      comments.value = comments.value.map((x) => (x.id === c.id ? { ...x, body: editBody.value } : x));
      editingId.value = null;
      toast.success("Komentar diperbarui");
    } catch {
      toast.error("Gagal simpan");
    }
  };

  const removeComment = async (id: number) => {
    if (!confirm("Hapus komentar ini?")) return;
    try {
      await $fetch(`/api/comments/${id}`, { method: "DELETE" });
      comments.value = comments.value.filter((x) => x.id !== id);
      toast.success("Komentar dihapus");
    } catch {
      toast.error("Gagal hapus komentar");
    }
  };

  const saveSummary = async () => {
    if (!activeReviewId.value) return;
    try {
      await $fetch(`/api/reviews/${activeReviewId.value}`, {
        method: "PUT",
        body: { summary: summary.value },
      });
      toast.success("Summary disimpan");
    } catch {
      toast.error("Gagal simpan summary");
    }
  };

  const submit = async () => {
    if (!activeReviewId.value) return;
    submitting.value = true;
    try {
      const data = await $fetch<{ comments: number; dropped: number }>(
        `/api/reviews/${activeReviewId.value}/submit`,
        { method: "POST" },
      );
      toast.success(`Review disubmit ke GitHub (${data.comments} komentar)`);
      if (data.dropped > 0) {
        toast.warning(`${data.dropped} komentar tak bisa dipasang (diff PR berubah) — dicatat di summary`);
      }
      mode.value = "submitted";
      onSubmitted?.();
    } catch {
      toast.error("Submit gagal");
    } finally {
      submitting.value = false;
    }
  };

  return {
    mode,
    activeReviewId,
    summary,
    comments,
    log,
    editingId,
    editBody,
    openThread,
    submitting,
    runReview,
    cancelRun,
    loadReview,
    addComment,
    startEditComment,
    cancelEditComment,
    saveEdit,
    removeComment,
    saveSummary,
    submit,
    toggleExclude,
    totalExclude,
    excludedPaths
  };
}
