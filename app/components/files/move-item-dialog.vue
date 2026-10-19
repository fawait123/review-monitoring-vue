<script setup lang="ts">
import { computed } from "vue";
import { FolderIcon, FolderTreeIcon } from "@lucide/vue";
import { collectSubtreeIds } from "~/utils/tree";
import type { FolderTreeNode } from "~~/shared/types";

const props = defineProps<{
  open: boolean;
  target: FolderTreeNode | null;
  tree: FolderTreeNode[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  move: [parentId: number | null];
}>();

const options = computed(() => {
  if (!props.target) return [];
  const excluded = collectSubtreeIds(props.tree, props.target.id);
  const out: { id: number; name: string; depth: number }[] = [];
  const walk = (list: FolderTreeNode[], depth: number): void => {
    for (const n of list) {
      if (n.kind !== "folder" || excluded.has(n.id)) continue;
      out.push({ id: n.id, name: n.name, depth });
      walk(n.children, depth + 1);
    }
  };
  walk(props.tree, 0);
  return out;
});

const pick = (parentId: number | null) => {
  emit("move", parentId);
  emit("update:open", false);
};
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Pindahkan "{{ target?.name }}"</DialogTitle>
        <DialogDescription>Pilih folder tujuan, atau pindah ke akar.</DialogDescription>
      </DialogHeader>
      <ScrollArea class="max-h-72">
        <div class="flex flex-col gap-0.5">
          <button type="button"
            class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            @click="pick(null)">
            <FolderTreeIcon class="size-4 shrink-0 text-muted-foreground" />
            <span class="font-medium">Akar (/)</span>
          </button>
          <button v-for="opt in options" :key="opt.id" type="button"
            class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            :style="{ paddingLeft: `${opt.depth * 20 + 8}px` }" @click="pick(opt.id)">
            <FolderIcon class="size-4 shrink-0 text-muted-foreground" />
            <span class="truncate">{{ opt.name }}</span>
          </button>
          <p v-if="options.length === 0" class="px-2 py-4 text-sm text-muted-foreground">
            Belum ada folder lain. Buat folder dulu, atau pindahkan ke akar.
          </p>
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
</template>
