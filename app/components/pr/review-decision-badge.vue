<script setup lang="ts">
import type { PR } from "~~/shared/types";

const props = defineProps<{ decision: PR["reviewDecision"]; draft: boolean }>();

const map: Record<string, string> = {
  APPROVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  CHANGES_REQUESTED: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  REVIEW_REQUIRED: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};
</script>

<template>
  <Badge v-if="props.draft" variant="outline" class="border-dashed text-muted-foreground">DRAFT</Badge>
  <span v-else-if="!props.decision" class="text-xs text-muted-foreground">—</span>
  <Badge v-else variant="outline" :class="map[props.decision] ?? 'bg-slate-500/15 text-slate-300 border-slate-500/30'">
    {{ props.decision === "CHANGES_REQUESTED" ? "CHANGES REQ" : props.decision }}
  </Badge>
</template>
