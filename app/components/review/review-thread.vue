<script setup lang="ts">
import { computed, ref } from "vue";
import type { DiffFile, ReviewComment } from "~~/shared/types";

const props = defineProps<{
  files: DiffFile[];
  comments: ReviewComment[];
  editingId: number | null;
  editBody: string;
  reviewerName: string;
}>();

const emit = defineEmits<{
  "edit-body": [v: string];
  "save-edit": [c: ReviewComment];
  "cancel-edit": [];
  edit: [c: ReviewComment];
  delete: [id: number];
}>();

const LINE_COLORS: Record<string, string> = {
  add: "bg-emerald-500/10",
  del: "bg-red-500/10",
  context: "",
};

const commentsByFile = computed(() => {
  const map = new Map<string, ReviewComment[]>();
  for (const c of props.comments) map.set(c.path, [...(map.get(c.path) ?? []), c]);
  return map;
});

const lineContent = computed(() => {
  const map = new Map<string, { content: string; kind: string; newLine: number | null }>();
  for (const f of props.files)
    for (const h of f.hunks)
      for (const l of h.lines)
        if (l.newLine !== null) map.set(`${f.path}:${l.newLine}`, l);
  return map;
});

const filesWithComments = computed(() => props.files.filter((f) => commentsByFile.value.has(f.path)));

const expanded = ref<Set<number>>(new Set());

const toggleExpanded = (id: number) => {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expanded.value = next;
};
</script>

<template>
  <div class="space-y-4">
    <div v-for="file in filesWithComments" :key="file.path" class="rounded-lg border overflow-hidden">
      <div class="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/50">
        <span class="font-mono text-sm truncate">{{ file.path }}</span>
        <span class="font-mono text-xs shrink-0">
          <span class="text-emerald-400">+{{ file.hunks.reduce((a, h) => a + h.lines.filter((l) => l.kind === "add").length, 0) }}</span>
          <span class="text-red-400">-{{ file.hunks.reduce((a, h) => a + h.lines.filter((l) => l.kind === "del").length, 0) }}</span>
        </span>
      </div>
      <div class="divide-y divide-border/50">
        <div v-for="c in [...(commentsByFile.get(file.path) ?? [])].sort((a, b) => a.line - b.line)" :key="c.id" class="px-4 py-3">
          <button class="w-full flex items-center gap-2 px-1 py-1 text-left rounded hover:bg-muted/40" @click="toggleExpanded(c.id)">
            <span class="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center shrink-0">
              {{ reviewerName.slice(0, 1).toUpperCase() }}
            </span>
            <span class="text-xs font-semibold truncate">{{ reviewerName }}</span>
            <Badge variant="outline" :class="c.status === 'submitted' ? 'text-emerald-400 border-emerald-500/30' : 'text-amber-400 border-amber-500/30'">
              {{ c.status }}
            </Badge>
            <span class="text-[11px] text-muted-foreground ml-auto font-mono">{{ c.path }}:{{ c.line }}</span>
            <span class="text-muted-foreground text-xs leading-none shrink-0">{{ expanded.has(c.id) || editingId === c.id ? "▾" : "▸" }}</span>
          </button>

          <div v-if="expanded.has(c.id) || editingId === c.id" class="space-y-2 mt-2">
            <div
              v-if="lineContent.get(`${c.path}:${c.line}`)"
              class="flex font-mono text-[13px] leading-5 rounded overflow-hidden"
              :class="LINE_COLORS[lineContent.get(`${c.path}:${c.line}`)!.kind] ?? ''"
            >
              <span class="w-10 px-2 text-right select-none text-muted-foreground/50 shrink-0 border-r border-border/50 py-0.5">
                {{ lineContent.get(`${c.path}:${c.line}`)!.newLine ?? c.line }}
              </span>
              <span class="whitespace-pre-wrap wrap-break-word flex-1 px-2 py-0.5">{{ lineContent.get(`${c.path}:${c.line}`)!.content || " " }}</span>
            </div>
            <div class="rounded-md border">
              <div v-if="editingId === c.id" class="p-3 space-y-2">
                <Textarea
                  :model-value="editBody"
                  rows="3"
                  class="font-sans text-sm"
                  autofocus
                  @update:model-value="emit('edit-body', String($event))"
                />
                <div class="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" @click="emit('cancel-edit')">Batal</Button>
                  <Button size="sm" :disabled="!editBody.trim()" @click="emit('save-edit', c)">Simpan</Button>
                </div>
              </div>
              <template v-else>
                <p class="text-sm whitespace-pre-wrap wrap-break-word px-3 py-2.5" :class="expanded.has(c.id) ? '' : 'line-clamp-3'">
                  {{ c.body }}
                </p>
                <button
                  v-if="c.body.length > 120"
                  class="text-[11px] text-muted-foreground hover:text-foreground px-3 pb-1"
                  @click="toggleExpanded(c.id)"
                >
                  {{ expanded.has(c.id) ? "Tutup" : "Selengkapnya" }}
                </button>
                <div class="flex gap-1 px-3 pb-2">
                  <Button variant="ghost" size="sm" class="h-6 px-2 text-[11px] text-muted-foreground" @click="emit('edit', c)">
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" class="h-6 px-2 text-[11px] text-red-400 hover:text-red-300" @click="emit('delete', c.id)">
                    Hapus
                  </Button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
