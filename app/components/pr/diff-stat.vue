<script setup lang="ts">
defineProps<{ additions: number; deletions: number }>();
</script>

<template>
  <span class="text-xs font-mono whitespace-nowrap">
    <span class="text-emerald-400">+{{ additions }}</span>
    <span class="text-red-400">-{{ deletions }}</span>
  </span>
</template>
