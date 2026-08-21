<script setup lang="ts">
import { usePrs } from "~/composables/usePrs";
import PrTable from "~/components/pr/pr-table.vue";

const {
  prs,
  repos,
  repo,
  state,
  page,
  total,
  totalPages,
  loading,
  refreshing,
  refresh,
  changeState,
} = usePrs();
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Dashboard Monitoring</h1>
      <p class="text-sm text-muted-foreground">
        Pull request open dari repo yang bisa diakses ({{ repos.length }} repo, {{ prs.length }} PR)
      </p>
    </div>

    <!-- Filters & Action Toolbar -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2">
        <Select :model-value="repo" @update:model-value="(v) => { repo = String(v ?? 'all'); page = 1 }">
          <SelectTrigger class="w-56">
            <SelectValue placeholder="Semua repo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua repo</SelectItem>
            <SelectItem v-for="r in repos" :key="r" :value="r">{{ r }}</SelectItem>
          </SelectContent>
        </Select>

        <Select :model-value="state" @update:model-value="(v) => { state = String(v ?? 'all'); page = 1 }">
          <SelectTrigger class="w-36">
            <SelectValue placeholder="Semua state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua state</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="MERGED">Merged</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>

        <span class="text-sm text-muted-foreground">{{ prs.length }} PR</span>
      </div>

      <Button :disabled="refreshing" @click="refresh">
        {{ refreshing ? "Mengumpulkan…" : "↻ Refresh" }}
      </Button>
    </div>

    <!-- PR Table -->
    <PrTable :prs="prs" :loading="loading" :on-state-change="changeState" />

    <!-- Pagination -->
    <div class="flex items-center justify-between">
      <span class="text-sm text-muted-foreground">{{ prs.length }} dari {{ total }} PR</span>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="page <= 1" @click="page = Math.max(1, page - 1)">
          ← Sebelumnya
        </Button>
        <span class="text-sm text-muted-foreground">Hal {{ page }} / {{ totalPages }}</span>
        <Button
          variant="outline"
          size="sm"
          :disabled="page >= totalPages"
          @click="page = Math.min(totalPages, page + 1)"
        >
          Berikutnya →
        </Button>
      </div>
    </div>
  </div>
</template>
