<script setup lang="ts">
import { ref } from "vue";
import type { ReviewComment } from "~~/shared/types";

const props = defineProps<{
  filePath: string;
  line: number;
  commentsByLine: Map<string, ReviewComment[]>;
  reviewerName: string;
  editingId: number | null;
  editBody: string;
  submitted: boolean;
}>();

const emit = defineEmits<{
  "open-thread": [v: null];
  "edit-body": [v: string];
  edit: [c: ReviewComment];
  "save-edit": [c: ReviewComment];
  "cancel-edit": [];
  delete: [id: number];
}>();

const expandedBodies = ref<Set<number>>(new Set());

const toggleExpanded = (id: number) => {
  const next = new Set(expandedBodies.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedBodies.value = next;
};
</script>

<template>
  <div class="flex justify-end">
    <div class="w-[min(480px,100%)] font-sans rounded-lg border bg-popover shadow-xl my-1 mr-4">
      <div class="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-t-lg border-b border-border/50">
        <span
          class="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center shrink-0">
          {{ reviewerName.slice(0, 1).toUpperCase() }}
        </span>
        <span class="text-xs font-semibold truncate">{{ reviewerName }}</span>
        <span class="font-mono text-[10px] text-muted-foreground">{{ filePath }}:{{ line }}</span>
        <button class="ml-auto text-muted-foreground hover:text-foreground text-sm leading-none px-1"
          @click="emit('open-thread', null)">
          ✕
        </button>
      </div>

      <div class="divide-y divide-border/50">
        <div v-for="c in commentsByLine.get(`${filePath}:${line}`) ?? []" :key="c.id"
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
