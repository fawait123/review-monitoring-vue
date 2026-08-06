<script setup lang="ts">
import type { PR } from "~~/shared/types";

const props = defineProps<{ state: PR["state"] }>();
const map: Record<PR["state"], { label: string; cls: string }> = {
  OPEN: { label: "OPEN", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  MERGED: { label: "MERGED", cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  CLOSED: { label: "CLOSED", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};
</script>

<template>
  <Badge variant="outline" :class="map[props.state].cls">
    {{ map[props.state].label }}
  </Badge>
</template>
