<script setup lang="ts">
import { ref } from "vue";
import { toast } from "vue-sonner";
import type { DiffFile, PR, Review, ReviewComment } from "~~/shared/types";
import ReviewThread from "./review-thread.vue";
import DiffViewer from "../diff/diff-viewer.vue";

const props = defineProps<{
  pr: PR;
  files: DiffFile[];
  reviews: Review[];
  commentsByReview: Record<number, ReviewComment[]>;
  reviewerName: string;
}>();

const emit = defineEmits<{ submitted: [] }>();

type Mode = "idle" | "running" | "editing" | "submitted";

interface LogLine {
  kind: "info" | "tool" | "text" | "console";
  text: string;
}

const draft = props.reviews.find((r) => r.status === "draft");
const submitted = props.reviews.filter((r) => r.status === "submitted");

const mode = ref<Mode>(submitted.length > 0 ? "submitted" : draft ? "editing" : "idle");
const activeReviewId = ref<number | null>(draft?.id ?? null);
const summary = ref<string>(draft?.summary ?? submitted[0]?.summary ?? "");
const comments = ref<ReviewComment[]>(activeReviewId.value ? props.commentsByReview[activeReviewId.value] ?? [] : []);
const log = ref<LogLine[]>([]);
const editingId = ref<number | null>(null);
const editBody = ref("");
const openThread = ref<{ path: string; line: number } | null>(null);
const submitting = ref(false);
const abortRef = ref<AbortController | null>(null);

const pushLog = (line: LogLine) => (log.value = [...log.value, line]);

const handleEvent = (event: string, data: any) => {
  switch (event) {
    case "delta":
      log.value = (() => {
        const last = log.value[log.value.length - 1];
        if (last?.kind === "text") return [...log.value.slice(0, -1), { kind: "text", text: last.text + data.text }];
        return [...log.value, { kind: "text", text: data.text }];
      })();
      break;
    case "tool":
      pushLog({
        kind: "tool",
        text: `${data.isError ? "⚠" : "▶"} tool ${data.toolName}${data.input ? `: ${String(data.input).slice(0, 120)}` : ""}`,
      });
      break;
    case "diff":
      pushLog({ kind: "info", text: `Diff: ${data.size.toLocaleString()} bytes, ${data.files.length} file` });
      break;
    case "model":
      pushLog({ kind: "info", text: `Model: ${data.model}` });
      break;
    case "complete":
      pushLog({ kind: "info", text: `✅ Review selesai (id ${data.reviewId}). Memuat hasil…` });
      loadReview(data.reviewId);
      break;
    case "file_start":
      pushLog({ kind: "console", text: `==============================` })
      pushLog({ kind: "console", text: `============= START ==========` })
      pushLog({ kind: "console", text: `==============================` })
      pushLog({ kind: "console", text: `Starting review file ${data.path}` })
      break;
    case "file_done":
      pushLog({ kind: "console", text: `Finish review file ${data.path}` })
      break;
    case "error":
      pushLog({ kind: "info", text: `❌ ${data.message}` });
      toast.error(data.message);
      mode.value = "idle";
      if (data.reviewId) {
        loadReview(data.reviewId);
      }
      break;
  }
};

const runReview = async () => {
  log.value = [];
  mode.value = "running";
  pushLog({ kind: "info", text: "Mengambil diff + menjalankan Pi agent…" });
  const controller = new AbortController();
  abortRef.value = controller;
  try {
    const res = await fetch(`/api/reviews/run?pr=${props.pr.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: props.pr.repo!.split("/")[0],
        repo: props.pr.repo!.split("/")[1],
        number: props.pr.number,
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
        const data = JSON.parse(block.replace(/^event: .+\n?/m, "").replace(/^data: /m, ""));
        console.log(data)
        handleEvent(event, data);
      }
    }
  } catch (err: any) {
    console.log(err)
    if (err.name !== "AbortError") {
      pushLog({ kind: "info", text: `❌ ${err.message}` });
      toast.error(err.message);
      mode.value = "idle";
    }
  }
};

const loadReview = async (id: number) => {
  const res = await fetch(`/api/reviews/${id}`);
  const data = await res.json();
  if (!res.ok) {
    toast.error(data.error ?? "Gagal memuat review");
    mode.value = "idle";
    return;
  }
  activeReviewId.value = id;
  summary.value = data.review.summary;
  comments.value = data.comments;
  mode.value = "editing";
  toast.success("Review siap diedit");
};

const cancelRun = () => {
  abortRef.value?.abort();
  mode.value = "idle";
};

const addComment = async (path: string, line: number, body: string) => {
  if (!activeReviewId.value) return;
  const res = await fetch(`/api/reviews/${activeReviewId.value}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, line, body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Gagal tambah komentar");
  comments.value = [...comments.value, data.comment];
  toast.success("Komentar ditambahkan");
};

const saveEdit = async (c: ReviewComment) => {
  const res = await fetch(`/api/comments/${c.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: editBody.value }),
  });
  const data = await res.json();
  if (!res.ok) {
    toast.error(data.error ?? "Gagal simpan");
    return;
  }
  comments.value = comments.value.map((x) => (x.id === c.id ? { ...x, body: editBody.value } : x));
  editingId.value = null;
  toast.success("Komentar diperbarui");
};

const removeComment = async (id: number) => {
  if (!confirm("Hapus komentar ini?")) return;
  const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json();
    toast.error(data.error ?? "Gagal hapus");
    return;
  }
  comments.value = comments.value.filter((x) => x.id !== id);
  toast.success("Komentar dihapus");
};

const saveSummary = async () => {
  if (!activeReviewId.value) return;
  const res = await fetch(`/api/reviews/${activeReviewId.value}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ summary: summary.value }),
  });
  if (!res.ok) {
    const data = await res.json();
    toast.error(data.error ?? "Gagal simpan summary");
    return;
  }
  toast.success("Summary disimpan");
};

const submit = async () => {
  if (!activeReviewId.value) return;
  submitting.value = true;
  try {
    const res = await fetch(`/api/reviews/${activeReviewId.value}/submit`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Submit gagal");
      return;
    }
    toast.success(`Review disubmit ke GitHub (${data.comments} komentar)`);
    if (data.dropped > 0) {
      toast.warning(`${data.dropped} komentar tak bisa dipasang (diff PR berubah) — dicatat di summary`);
    }
    mode.value = "submitted";
    emit("submitted");
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
    <div class="min-w-0">
      <DiffViewer :submitted="submitted.length > 0" :files="files" :comments="comments" :reviewer-name="reviewerName"
        :open-thread="openThread" :editing-id="editingId" :edit-body="editBody" @open-thread="openThread = $event"
        @add-comment="addComment" @edit-body="editBody = $event"
        @edit="(c: ReviewComment) => { editingId = c.id; editBody = c.body }" @save-edit="saveEdit"
        @cancel-edit="editingId = null" @delete="removeComment" />
    </div>

    <div class="space-y-4 lg:sticky lg:top-6">
      <div v-if="mode === 'idle'" class="rounded-lg border p-4 space-y-3">
        <h3 class="font-semibold text-sm">Review dengan Pi agent</h3>
        <p class="text-xs text-muted-foreground">
          Pi agent menganalisis diff dan menghasilkan draft komentar review. Kamu bisa edit sebelum submit ke GitHub.
        </p>
        <Button class="w-full" @click="runReview">▶ Jalankan Review</Button>
      </div>

      <div v-if="mode === 'running'" class="rounded-lg border p-4 space-y-3">
        <h3 class="font-semibold text-sm flex items-center gap-2">
          <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Pi agent sedang mereview…
        </h3>
        <div class="rounded bg-black/40 p-3 h-64 overflow-y-auto font-mono text-xs space-y-1">
          <div v-for="(l, i) in log" :key="i"
            :class="l.kind === 'info' ? 'text-sky-400' : l.kind === 'tool' ? 'text-amber-400/80' : l.kind === 'console' ? 'text-pink-400/80' : 'text-emerald-300/90 whitespace-pre-wrap wrap-break-word'">
            {{ l.text }}
          </div>
          <span v-if="log.length === 0" class="text-muted-foreground">menunggu stream…</span>
        </div>
        <Button variant="outline" size="sm" class="w-full" @click="cancelRun">Batalkan</Button>
      </div>

      <div v-if="mode === 'editing'"
        class="space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto pr-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
        <div class="rounded-lg border p-4 space-y-3">
          <h3 class="font-semibold text-sm">Summary review</h3>
          <Textarea v-model="summary" rows="6" placeholder="Ringkasan review level PR…" />
          <Button size="sm" variant="outline" class="w-full" @click="saveSummary">Simpan summary</Button>
        </div>

        <div class="rounded-lg border p-4 space-y-3">
          <h3 class="font-semibold text-sm">
            Komentar <span class="text-muted-foreground font-normal">({{ comments.length }})</span>
          </h3>
          <p v-if="comments.length === 0" class="text-xs text-muted-foreground">
            Belum ada komentar. Klik <b>+</b> pada baris di diff untuk menambah.
          </p>
          <div class="space-y-2">
            <ReviewThread :files="files" :comments="comments" :editing-id="editingId" :edit-body="editBody"
              :reviewer-name="reviewerName" @edit-body="editBody = $event" @save-edit="saveEdit"
              @cancel-edit="editingId = null"
              @edit="(c: ReviewComment) => { editingId = c.id; editBody = c.body; openThread = { path: c.path, line: c.line } }"
              @delete="removeComment" />
          </div>
        </div>

        <Button class="w-full" :disabled="submitting || comments.filter((c) => c.body.trim()).length === 0"
          @click="submit">
          {{submitting ? "Mengirim…" : `🚀 Submit Review ke GitHub (${comments.filter((c) => c.body.trim()).length})`
          }}
        </Button>
        <Button variant="outline" class="w-full" @click="runReview">↻ Review Ulang</Button>
      </div>

      <div v-if="mode === 'submitted'" class="rounded-lg border p-4 space-y-3">
        <h3 class="font-semibold text-sm text-emerald-400">✓ Review terkirim</h3>
        <p class="text-xs text-muted-foreground">Review sudah disubmit ke GitHub. Lihat di PR:</p>
        <Button variant="outline" class="w-full">
          <a :href="pr.url" target="blank" rel="noreferrer" class="w-full">Buka di GitHub ↗</a>
        </Button>
        <Button variant="outline" class="w-full" @click="runReview">↻ Review Ulang</Button>
      </div>
    </div>
  </div>
</template>
