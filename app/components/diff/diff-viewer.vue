<script setup lang="ts">
import { computed, ref } from "vue";
import type { DiffFile, ReviewComment } from "~~/shared/types";
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
    <div v-for="file in files" :key="file.path" class="rounded-lg border overflow-hidden">
      <!-- File Header -->
      <button class="w-full flex items-center justify-between px-4 py-2 bg-muted/30 hover:bg-muted/50 text-left"
        @click="toggleFile(file.path)">
        <span class="font-mono text-sm truncate">{{ file.path }}</span>
        <span class="flex items-center gap-2 shrink-0">
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
