<script setup lang="ts">
import type { LogLine } from "~/composables/useReview";

defineProps<{
  log: LogLine[];
}>();

defineEmits<{
  cancel: [];
}>();
</script>

<template>
  <div class="rounded-lg border p-4 space-y-3">
    <h3 class="font-semibold text-sm flex items-center gap-2">
      <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      Pi agent sedang mereview…
    </h3>
    <div class="rounded bg-black/40 p-3 h-64 overflow-y-auto font-mono text-xs space-y-1">
      <div
        v-for="(l, i) in log"
        :key="i"
        :class="
          l.kind === 'info'
            ? 'text-sky-400'
            : l.kind === 'tool'
              ? 'text-amber-400/80'
              : l.kind === 'console'
                ? 'text-pink-400/80'
                : 'text-emerald-300/90 whitespace-pre-wrap wrap-break-word'
        "
      >
        {{ l.text }}
      </div>
      <span v-if="log.length === 0" class="text-muted-foreground">menunggu stream…</span>
    </div>
    <Button variant="outline" size="sm" class="w-full" @click="$emit('cancel')">
      Batalkan
    </Button>
  </div>
</template>
