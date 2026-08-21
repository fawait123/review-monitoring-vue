<script setup lang="ts">
import AnalyticsKpis from "~/components/analytics/analytics-kpis.vue";
import AuthorChart from "~/components/analytics/author-chart.vue";
import RatioChart from "~/components/analytics/ratio-chart.vue";
import RepoChart from "~/components/analytics/repo-chart.vue";
import TrendChart from "~/components/analytics/trend-chart.vue";
import type { AnalyticsData } from "~~/shared/types";

const { data, error } = useAsyncData("analytics", () =>
  $fetch<AnalyticsData>("/api/analytics"),
);
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
      <h1 class="text-2xl font-bold text-destructive">Gagal memuat analytics</h1>
      <p class="text-muted-foreground">{{ error.message }}</p>
    </div>

    <template v-else-if="data">
      <!-- 6 KPI Grid -->
      <AnalyticsKpis :data="data" />

      <!-- 4 Analytics Charts -->
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
