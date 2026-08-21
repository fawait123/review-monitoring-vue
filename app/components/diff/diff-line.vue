<script setup lang="ts">
import type { DiffLine } from "~~/shared/types";

const props = defineProps<{
  line: DiffLine;
  filePath: string;
  commentCount: number;
  isThreadOpen: boolean;
}>();

defineEmits<{
  "add-comment": [];
  "toggle-thread": [];
}>();
</script>

<template>
  <div
    class="group flex"
    :class="
      line.kind === 'add'
        ? 'bg-emerald-500/10 hover:bg-emerald-500/20'
        : line.kind === 'del'
          ? 'bg-red-500/10'
          : 'text-muted-foreground'
    "
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
      title="Tambah komentar"
      @click="$emit('add-comment')"
    >
      +
    </button>
    <span class="whitespace-pre-wrap wrap-break-word flex-1">{{ line.content || " " }}</span>
    <template v-if="line.newLine !== null && commentCount > 0">
      <button
        class="shrink-0 mr-2 self-center"
        :title="`${commentCount} komentar`"
        @click="$emit('toggle-thread')"
      >
        <Badge
          :variant="isThreadOpen ? 'default' : 'outline'"
          :class="
            isThreadOpen
              ? 'text-amber-950 bg-amber-400 border-amber-400'
              : 'text-amber-400 border-amber-500/30'
          "
        >
          {{ commentCount }}
        </Badge>
      </button>
    </template>
  </div>
</template>
