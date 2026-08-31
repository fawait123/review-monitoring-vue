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

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const kpis = computed(() => {
  const d = props.data;
  const mergedCount = d.stateRatio.find((s) => s.state === "MERGED")?.count ?? 0;
  return [
    { label: "Total PR", value: String(d.total), sub: undefined as string | undefined },
    { label: "Repo", value: String(d.repoCount), sub: undefined },
    { label: "Open", value: String(d.stateRatio.find((s) => s.state === "OPEN")?.count ?? 0), sub: undefined },
    { label: "Merged", value: String(mergedCount), sub: undefined },
    { label: "Closed", value: String(d.stateRatio.find((s) => s.state === "CLOSED")?.count ?? 0), sub: undefined },
    { label: "Avg time-to-review", value: fmtDays(d.avgTimeToReviewDays), sub: `${d.reviewedCount} PR direview` },
    { label: "Avg time-to-merge", value: fmtDays(d.avgMergeTimeDays), sub: `${mergedCount} PR merged` },
    { label: "Draft PR", value: String(d.draftCount), sub: d.total > 0 ? `${((d.draftCount / d.total) * 100).toFixed(0)}% dari total` : undefined },
    { label: "Total Additions", value: formatNum(d.codeChurn.reduce((s, c) => s + c.additions, 0)), sub: "baris kode" },
  ];
});
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
