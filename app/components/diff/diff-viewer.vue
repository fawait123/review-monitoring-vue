<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { DiffFile, ReviewComment } from "~~/shared/types";

const props = defineProps<{
  files: DiffFile[];
  comments: ReviewComment[];
  reviewerName: string;
  openThread: { path: string; line: number } | null;
  editingId: number | null;
  editBody: string;
  submitted: boolean;
}>();

const emit = defineEmits<{
  "open-thread": [v: { path: string; line: number } | null];
  "add-comment": [path: string, line: number, body: string];
  "edit-body": [v: string];
  edit: [c: ReviewComment];
  "save-edit": [c: ReviewComment];
  "cancel-edit": [];
  delete: [id: number];
}>();

interface Composer {
  file: DiffFile;
  line: number;
  body: string;
  saving: boolean;
}

const composer = ref<Composer | null>(null);
const openFiles = ref<Set<string>>(new Set(props.files.map((f) => f.path)));
const expandedBodies = ref<Set<number>>(new Set());
const editRef = ref<HTMLTextAreaElement | null>(null);
const composerRef = ref<HTMLTextAreaElement | null>(null);

watch([() => props.editingId, composer], () => {
  const el = composer.value ? composerRef.value : editRef.value;
  if (el) {
    el.scrollIntoView({ block: "nearest" });
    el.focus({ preventScroll: true });
  }
});

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

const save = async () => {
  if (!composer.value || !composer.value.body.trim()) return;
  composer.value = { ...composer.value, saving: true };
  try {
    await emit("add-comment", composer.value.file.path, composer.value.line, composer.value.body.trim());
    composer.value = null;
  } finally {
    if (composer.value) composer.value = { ...composer.value, saving: false };
  }
};
</script>

<template>
  <div class="space-y-4">
    <div v-for="file in files" :key="file.path" class="rounded-lg border overflow-hidden">
      <button
        class="w-full flex items-center justify-between px-4 py-2 bg-muted/30 hover:bg-muted/50 text-left"
        @click="toggleFile(file.path)"
      >
        <span class="font-mono text-sm truncate">{{ file.path }}</span>
        <span class="flex items-center gap-2 shrink-0">
          <Badge v-if="comments.filter((c) => c.path === file.path).length > 0" variant="outline"
            class="text-amber-400 border-amber-500/30">
            {{ comments.filter((c) => c.path === file.path).length }} komentar
          </Badge>
          <span class="font-mono text-xs">
            <span class="text-emerald-400">+{{ file.hunks.reduce((a, h) => a + h.lines.filter((l) => l.kind === "add").length, 0) }}</span>
            <span class="text-red-400">-{{ file.hunks.reduce((a, h) => a + h.lines.filter((l) => l.kind === "del").length, 0) }}</span>
          </span>
        </span>
      </button>

      <div v-if="openFiles.has(file.path)" class="font-mono text-[13px] leading-5 overflow-x-auto">
        <div v-for="(hunk, hi) in file.hunks" :key="hi">
          <div class="px-4 py-1 bg-sky-500/10 text-sky-400 text-xs border-y border-sky-500/20">
            @@ -{{ hunk.oldStart }},{{ hunk.oldLines }} +{{ hunk.newStart }},{{ hunk.newLines }} @@
          </div>
          <template v-for="(line, li) in hunk.lines" :key="li">
            <div
              class="group flex"
              :class="line.kind === 'add' ? 'bg-emerald-500/10 hover:bg-emerald-500/20' : line.kind === 'del' ? 'bg-red-500/10' : 'text-muted-foreground'"
            >
              <span class="w-12 px-2 text-right select-none text-muted-foreground/50 shrink-0">
                {{ line.oldLine ?? "" }}
              </span>
              <span class="w-12 px-2 text-right select-none text-muted-foreground/50 shrink-0 border-r border-border/50">
                {{ line.newLine ?? "" }}
              </span>
              <button
                class="w-6 shrink-0 text-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground disabled:opacity-0"
                :disabled="line.newLine === null"
                :title="'Tambah komentar'"
                @click="line.newLine !== null && (composer = { file, line: line.newLine, body: '', saving: false })"
              >
                +
              </button>
              <span class="whitespace-pre-wrap wrap-break-word flex-1">{{ line.content || " " }}</span>
              <template v-if="line.newLine !== null">
                <button
                  v-if="(commentsByLine.get(`${file.path}:${line.newLine}`) ?? []).length > 0"
                  class="shrink-0 mr-2 self-center"
                  :title="`${(commentsByLine.get(`${file.path}:${line.newLine}`) ?? []).length} komentar`"
                  @click="
                    openThread?.path === file.path && openThread.line === line.newLine
                      ? emit('open-thread', null)
                      : emit('open-thread', { path: file.path, line: line.newLine })
                  "
                >
                  <Badge
                    :variant="openThread?.path === file.path && openThread.line === line.newLine ? 'default' : 'outline'"
                    :class="openThread?.path === file.path && openThread.line === line.newLine
                      ? 'text-amber-950 bg-amber-400 border-amber-400'
                      : 'text-amber-400 border-amber-500/30'"
                  >
                    {{ (commentsByLine.get(`${file.path}:${line.newLine}`) ?? []).length }}
                  </Badge>
                </button>
              </template>
            </div>

            <div
              v-if="line.newLine !== null && openThread?.path === file.path && openThread.line === line.newLine"
              class="flex justify-end"
            >
              <div class="w-[min(480px,100%)] font-sans rounded-lg border bg-popover shadow-xl my-1 mr-4">
                <div class="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-t-lg border-b border-border/50">
                  <span class="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center shrink-0">
                    {{ reviewerName.slice(0, 1).toUpperCase() }}
                  </span>
                  <span class="text-xs font-semibold truncate">{{ reviewerName }}</span>
                  <span class="font-mono text-[10px] text-muted-foreground">{{ file.path }}:{{ line.newLine }}</span>
                  <button class="ml-auto text-muted-foreground hover:text-foreground text-sm leading-none px-1" @click="emit('open-thread', null)">
                    ✕
                  </button>
                </div>
                <div class="divide-y divide-border/50">
                  <div v-for="c in commentsByLine.get(`${file.path}:${line.newLine}`) ?? []" :key="c.id" class="px-3 py-2 space-y-1.5">
                    <div class="flex items-center gap-2">
                      <Badge variant="outline" :class="c.status === 'submitted' ? 'text-emerald-400 border-emerald-500/30' : 'text-amber-400 border-amber-500/30'">
                        {{ c.status }}
                      </Badge>
                      <button
                        v-if="editingId !== c.id && c.body.length > 120"
                        class="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
                        @click="toggleExpanded(c.id)"
                      >
                        {{ expandedBodies.has(c.id) ? "Tutup" : "Selengkapnya" }}
                      </button>
                    </div>
                    <div v-if="editingId === c.id" class="space-y-2">
                      <div v-if="submitted" class="text-justify">{{ editBody }}</div>
                      <Textarea v-else ref="editRef" :model-value="editBody" rows="3" class="font-sans text-sm"
                        @update:model-value="emit('edit-body', String($event))" />
                      <div v-if="!submitted" class="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" @click="emit('cancel-edit')">Batal</Button>
                        <Button size="sm" :disabled="!editBody.trim()" @click="emit('save-edit', c)">Simpan</Button>
                      </div>
                    </div>
                    <template v-else>
                      <p class="text-sm whitespace-pre-wrap wrap-break-word" :class="expandedBodies.has(c.id) ? '' : 'line-clamp-3'">
                        {{ c.body }}
                      </p>
                      <div v-if="!submitted" class="flex justify-end gap-1">
                        <button class="text-[11px] text-muted-foreground hover:text-foreground px-1" @click="emit('edit', c)">
                          ✏️ Edit
                        </button>
                        <button class="text-[11px] text-red-400/80 hover:text-red-400 px-1" @click="emit('delete', c.id)">
                          🗑 Hapus
                        </button>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <div
            v-if="composer?.file.path === file.path && hunk.lines.some((l) => l.newLine === composer!.line)"
            class="px-4 py-2 bg-background border-t border-border/50"
          >
            <div class="text-xs text-muted-foreground mb-1">Komentar @ {{ composer!.file.path }}:{{ composer!.line }}</div>
            <Textarea
              ref="composerRef"
              :model-value="composer.body"
              rows="3"
              placeholder="Tulis komentar review…"
              class="font-sans text-sm"
              @update:model-value="composer && (composer = { ...composer, body: String($event) })"
            />
            <div class="flex justify-end gap-2 mt-2">
              <Button variant="ghost" size="sm" @click="composer = null">Batal</Button>
              <Button size="sm" :disabled="composer.saving || !composer.body.trim()" @click="save">
                Simpan
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
