<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { DiffFile, ReviewComment } from "~~/shared/types";
import type { FileProgress, FileStatus } from "~/composables/useReviewState";
import DiffLineComponent from "./diff-line.vue";
import DiffCommentComposer from "./diff-comment-composer.vue";
import DiffThreadPopup from "./diff-thread-popup.vue";
import Checkbox from "~/components/ui/checkbox/Checkbox.vue";
import { Label } from "reka-ui";

const props = defineProps<{
  files: DiffFile[];
  comments: ReviewComment[];
  reviewerName: string;
  openThread: { path: string; line: number } | null;
  editingId: number | null;
  editBody: string;
  submitted: boolean;
  excludedFiles: string[]
  fileProgress: Record<string, FileProgress>
}>();

const emit = defineEmits<{
  "open-thread": [v: { path: string; line: number } | null];
  "add-comment": [path: string, line: number, body: string];
  "edit-body": [v: string];
  edit: [c: ReviewComment];
  "save-edit": [c: ReviewComment];
  "cancel-edit": [];
  delete: [id: number];
  "toggle-exclude": [path: string, checked: boolean]
}>();

interface ComposerState {
  file: DiffFile;
  line: number;
  saving: boolean;
}

const composer = ref<ComposerState | null>(null);
const openFiles = ref<Set<string>>(new Set(props.files.map((f) => f.path)));

// Warna + label per status file. `pending` sengaja netral supaya yang menonjol
// hanya progres saat review jalan, bukan semua file sekaligus.
const STATUS_STYLE: Record<FileStatus, { dot: string; text: string; label: string }> = {
  pending: { dot: "bg-muted-foreground/40", text: "text-muted-foreground", label: "Menunggu" },
  active: { dot: "bg-sky-400 animate-pulse", text: "text-sky-400", label: "Meninjau" },
  done: { dot: "bg-emerald-500", text: "text-emerald-500", label: "Selesai" },
  skipped: { dot: "bg-muted-foreground/30", text: "text-muted-foreground", label: "Dilewati" },
  error: { dot: "bg-red-500", text: "text-red-500", label: "Gagal" },
};

// Tidak ada di record = belum disentuh -> pending.
const progressOf = (path: string): FileProgress => props.fileProgress[path] ?? { status: "pending" };

// Status satu baris; null kalau file-nya belum disentuh, sehingga baris normal
// tetap polos seperti sebelumnya.
const lineState = (path: string, lineNo: number | null): "active" | "done" | null => {
  const p = props.fileProgress[path];
  if (!p || !p.spans || lineNo === null) return null;
  for (const s of p.spans) {
    if (lineNo >= s.from && lineNo <= s.to) return s.active ? "active" : "done";
  }
  return null;
};

// Auto-buka file yang sedang direview lalu gulung ke awal rentang aktifnya, supaya
// reviewer tidak perlu mencari-cari di diff yang bisa ratusan baris.
watch(
  () => {
    const entry = Object.entries(props.fileProgress).find(([, p]) => p.status === "active");
    if (!entry) return null;
    const span = entry[1].spans?.find((s) => s.active);
    return span ? { path: entry[0], from: span.from } : null;
  },
  async (cur) => {
    if (!cur) return;
    if (!openFiles.value.has(cur.path)) openFiles.value = new Set([...openFiles.value, cur.path]);
    await nextTick();
    // Scope ke container file ini saja: nomor baris yang sama bisa muncul di file lain.
    const scope = document.querySelector<HTMLElement>(`[data-file-path="${CSS.escape(cur.path)}"]`);
    const target = scope?.querySelector<HTMLElement>(`[data-new-line="${cur.from}"]`);
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  },
);

const commentsByLine = computed(() => {
  const map = new Map<string, ReviewComment[]>();
  for (const c of props.comments) {
    const key = `${c.path}:${c.line}`;
    map.set(key, [...(map.get(key) ?? []), c]);
  }
  return map;
});

const toggleFile = (path: string) => {
  const next = new Set(openFiles.value);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  openFiles.value = next;
};

const handleAddComment = async (body: string) => {
  if (!composer.value) return;
  composer.value.saving = true;
  try {
    emit("add-comment", composer.value.file.path, composer.value.line, body);
    composer.value = null;
  } finally {
    if (composer.value) composer.value.saving = false;
  }
};
</script>

<template>
  <div class="space-y-4">
    <div v-for="file in files" :key="file.path"
      :data-file-path="file.path"
      class="rounded-lg border overflow-hidden border-l-4 transition-colors"
      :class="{
        'border-l-sky-400': progressOf(file.path).status === 'active',
        'border-l-emerald-500/60': progressOf(file.path).status === 'done',
        'border-l-red-500': progressOf(file.path).status === 'error',
        'border-l-muted-foreground/20': progressOf(file.path).status === 'skipped',
        'border-l-transparent': progressOf(file.path).status === 'pending',
      }">
      <!-- File Header -->
      <button class="w-full flex items-center justify-between gap-3 px-4 py-2 text-left"
        :class="progressOf(file.path).status === 'active' ? 'bg-sky-500/10' : 'bg-muted/30 hover:bg-muted/50'"
        @click="toggleFile(file.path)">
        <span class="flex items-center gap-2 min-w-0">
          <span class="w-1.5 h-1.5 rounded-full shrink-0"
            :class="STATUS_STYLE[progressOf(file.path).status].dot" />
          <span class="font-mono text-sm truncate"
            :class="progressOf(file.path).status === 'skipped' ? 'opacity-50' : ''">{{ file.path }}</span>
        </span>
        <span class="flex items-center gap-2 shrink-0">
          <span class="text-[11px] font-mono"
            :class="STATUS_STYLE[progressOf(file.path).status].text">
            <template v-if="progressOf(file.path).status === 'active' && progressOf(file.path).total">
              {{ progressOf(file.path).chunk }}/{{ progressOf(file.path).total }}
            </template>
            <template v-else>{{ STATUS_STYLE[progressOf(file.path).status].label }}</template>
          </span>
          <Badge v-if="comments.filter((c) => c.path === file.path).length > 0" variant="outline"
            class="text-amber-400 border-amber-500/30">
            {{comments.filter((c) => c.path === file.path).length}} komentar
          </Badge>
          <span class="font-mono text-xs">
            <span class="text-emerald-400">
              +{{file.hunks.reduce((a, h) => a + h.lines.filter((l) => l.kind === "add").length, 0)}}
            </span>
            <span class="text-red-400">
              -{{file.hunks.reduce((a, h) => a + h.lines.filter((l) => l.kind === "del").length, 0)}}
            </span>
          </span>
        </span>
      </button>

      <!-- File Diff Contents -->
      <div v-if="openFiles.has(file.path)" class="font-mono text-[13px] leading-5 overflow-x-auto">
        <div
          class="flex items-center gap-3 px-4 py-1 bg-sky-500/10 text-sky-400 text-xs border-y border-sky-500/20 mb-1">
          <Checkbox :id="`exclude-review-${files}`" :value="file.path"
            :model-value="excludedFiles.some((path) => path === file.path)"
            @update:model-value="(val) => emit('toggle-exclude', file.path, Boolean(val))" />
          <Label :for="`exclude-review-${files}`" class="text-xs">Exclude review</Label>
        </div>
        <div v-for="(hunk, hi) in file.hunks" :key="hi">
          <div class="px-4 py-1 bg-sky-500/10 text-sky-400 text-xs border-y border-sky-500/20">
            @@ -{{ hunk.oldStart }},{{ hunk.oldLines }} +{{ hunk.newStart }},{{ hunk.newLines }} @@
          </div>

          <template v-for="(line, li) in hunk.lines" :key="li">
            <DiffLineComponent :line="line" :file-path="file.path"
              :comment-count="(commentsByLine.get(`${file.path}:${line.newLine}`) ?? []).length"
              :is-thread-open="openThread?.path === file.path && openThread.line === line.newLine"
              :line-state="lineState(file.path, line.newLine)"
              @add-comment="line.newLine !== null && (composer = { file, line: line.newLine, saving: false })"
              @toggle-thread="
                openThread?.path === file.path && openThread.line === line.newLine
                  ? emit('open-thread', null)
                  : emit('open-thread', { path: file.path, line: line.newLine! })
                " />

            <!-- Thread popup -->
            <DiffThreadPopup
              v-if="line.newLine !== null && openThread?.path === file.path && openThread.line === line.newLine"
              :file-path="file.path"
              :line="line.newLine!"
              :comments-by-line="commentsByLine"
              :reviewer-name="reviewerName"
              :editing-id="editingId"
              :edit-body="editBody"
              :submitted="submitted"
              @open-thread="emit('open-thread', $event)"
              @edit-body="emit('edit-body', $event)"
              @edit="emit('edit', $event)"
              @save-edit="emit('save-edit', $event)"
              @cancel-edit="emit('cancel-edit')"
              @delete="emit('delete', $event)"
            />
          </template>

          <!-- Inline Comment Composer -->
          <DiffCommentComposer
            v-if="composer?.file.path === file.path && hunk.lines.some((l) => l.newLine === composer!.line)"
            :file-path="composer.file.path" :line="composer.line" :saving="composer.saving" @save="handleAddComment"
            @cancel="composer = null" />
        </div>
      </div>
    </div>
  </div>
</template>
