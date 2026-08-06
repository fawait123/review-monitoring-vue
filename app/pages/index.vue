<script setup lang="ts">
import AuthorChart from "~/components/analytics/author-chart.vue";
import RatioChart from "~/components/analytics/ratio-chart.vue";
import RepoChart from "~/components/analytics/repo-chart.vue";
import TrendChart from "~/components/analytics/trend-chart.vue";
import type { AnalyticsData } from "~~/shared/types";

const { data, error } = await useAsyncData("analytics", () =>
  $fetch<AnalyticsData>("/api/analytics"),
);

function fmtDays(days: number | null): string {
  if (days === null) return "—";
  if (days < 1) return `${Math.round(days * 24)} jam`;
  return `${days.toFixed(1)} hari`;
}

const kpis = computed(() => {
  if (!data.value) return [];
  const d = data.value;
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
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Dashboard Analytics</h1>
      <p class="text-sm text-muted-foreground">
        Statistik pull request dari seluruh repo ter-<i>collect</i> (refresh otomatis via dashboard)
      </p>
    </div>

    <div v-if="error">
      <h1 class="text-2xl font-bold">Gagal memuat analytics</h1>
      <p class="text-muted-foreground">{{ error.message }}</p>
    </div>

    <template v-else-if="data">
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

      <div class="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">Open / Merged / Closed Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientOnly>
              <RatioChart :data="data.stateRatio" />
            </ClientOnly>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">PR per Repo</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientOnly>
              <RepoChart :data="data.perRepo" />
            </ClientOnly>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">PR per Author</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientOnly>
              <AuthorChart :data="data.perAuthor" />
            </ClientOnly>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">Trend PR per Minggu (12 bulan)</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientOnly>
              <TrendChart :data="data.trend" />
            </ClientOnly>
          </CardContent>
        </Card>
      </div>
    </template>
  </div>
</template>
