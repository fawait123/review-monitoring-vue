<script setup lang="ts">
import { computed } from "vue";
import type { AnalyticsData } from "~~/shared/types";

const props = defineProps<{
  data: AnalyticsData;
}>();

function fmtDays(days: number | null): string {
  if (days === null) return "—";
  if (days < 1) return `${Math.round(days * 24)} jam`;
  return `${days.toFixed(1)} hari`;
}

const kpis = computed(() => {
  const d = props.data;
  return [
    { label: "Total PR", value: String(d.total), sub: undefined as string | undefined },
    { label: "Repo", value: String(d.repoCount), sub: undefined },
    { label: "Open", value: String(d.stateRatio.find((s) => s.state === "OPEN")?.count ?? 0), sub: undefined },
    { label: "Merged", value: String(d.stateRatio.find((s) => s.state === "MERGED")?.count ?? 0), sub: undefined },
    { label: "Closed", value: String(d.stateRatio.find((s) => s.state === "CLOSED")?.count ?? 0), sub: undefined },
    { label: "Avg time-to-review", value: fmtDays(d.avgTimeToReviewDays), sub: `${d.reviewedCount} PR direview` },
  ];
});
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
    <Card v-for="k in kpis" :key="k.label">
      <CardHeader class="pb-1">
        <CardTitle class="text-xs font-medium text-muted-foreground">{{ k.label }}</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="text-2xl font-bold">{{ k.value }}</div>
        <div v-if="k.sub" class="text-[11px] text-muted-foreground mt-0.5">{{ k.sub }}</div>
      </CardContent>
    </Card>
  </div>
</template>
