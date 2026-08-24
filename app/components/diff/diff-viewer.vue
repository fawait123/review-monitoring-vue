<script setup lang="ts">
import { computed, ref } from "vue";
import type { DiffFile, ReviewComment } from "~~/shared/types";
import DiffLineComponent from "./diff-line.vue";
import DiffCommentComposer from "./diff-comment-composer.vue";
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
const expandedBodies = ref<Set<number>>(new Set());

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

const toggleExpanded = (id: number) => {
  const next = new Set(expandedBodies.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedBodies.value = next;
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

            <!-- Thread popup popover on the line -->
            <div v-if="line.newLine !== null && openThread?.path === file.path && openThread.line === line.newLine"
              class="flex justify-end">
              <div class="w-[min(480px,100%)] font-sans rounded-lg border bg-popover shadow-xl my-1 mr-4">
                <div class="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-t-lg border-b border-border/50">
                  <span
                    class="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center shrink-0">
                    {{ reviewerName.slice(0, 1).toUpperCase() }}
                  </span>
                  <span class="text-xs font-semibold truncate">{{ reviewerName }}</span>
                  <span class="font-mono text-[10px] text-muted-foreground">{{ file.path }}:{{ line.newLine }}</span>
                  <button class="ml-auto text-muted-foreground hover:text-foreground text-sm leading-none px-1"
                    @click="emit('open-thread', null)">
                    ✕
                  </button>
                </div>

                <div class="divide-y divide-border/50">
                  <div v-for="c in commentsByLine.get(`${file.path}:${line.newLine}`) ?? []" :key="c.id"
                    class="px-3 py-2 space-y-1.5">
                    <div class="flex items-center gap-2">
                      <Badge variant="outline"
                        :class="c.status === 'submitted' ? 'text-emerald-400 border-emerald-500/30' : 'text-amber-400 border-amber-500/30'">
                        {{ c.status }}
                      </Badge>
                      <button v-if="editingId !== c.id && c.body.length > 120"
                        class="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
                        @click="toggleExpanded(c.id)">
                        {{ expandedBodies.has(c.id) ? "Tutup" : "Selengkapnya" }}
                      </button>
                    </div>

                    <div v-if="editingId === c.id" class="space-y-2">
                      <div v-if="submitted" class="text-justify">{{ editBody }}</div>
                      <Textarea v-else :model-value="editBody" rows="3" class="font-sans text-sm"
                        @update:model-value="emit('edit-body', String($event))" />
                      <div v-if="!submitted" class="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" @click="emit('cancel-edit')">Batal</Button>
                        <Button size="sm" :disabled="!editBody.trim()" @click="emit('save-edit', c)">
                          Simpan
                        </Button>
                      </div>
                    </div>

                    <template v-else>
                      <p class="text-sm whitespace-pre-wrap wrap-break-word"
                        :class="expandedBodies.has(c.id) ? '' : 'line-clamp-3'">
                        {{ c.body }}
                      </p>
                      <div v-if="!submitted" class="flex justify-end gap-1">
                        <button class="text-[11px] text-muted-foreground hover:text-foreground px-1"
                          @click="emit('edit', c)">
                          ✏️ Edit
                        </button>
                        <button class="text-[11px] text-red-400/80 hover:text-red-400 px-1"
                          @click="emit('delete', c.id)">
                          🗑 Hapus
                        </button>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
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
