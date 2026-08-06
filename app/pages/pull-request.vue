<script setup lang="ts">
import { toast } from "vue-sonner";
import PrTable from "~/components/pr/pr-table.vue";
import type { PR } from "~~/shared/types";

const PAGE_SIZE = 20;

const prs = ref<PR[]>([]);
const repos = ref<string[]>([]);
const repo = ref<string>("all");
const state = ref<string>("OPEN");
const page = ref(1);
const total = ref(0);
const loading = ref(true);
const refreshing = ref(false);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

const fetchData = async (r: string, s: string, pg: number) => {
  const q = new URLSearchParams();
  if (r !== "all") q.set("repo", r);
  if (s !== "all") q.set("state", s);
  q.set("page", String(pg));
  q.set("pageSize", String(PAGE_SIZE));
  const res = await fetch(`/api/collect?${q.toString()}`);
  if (!res.ok) throw new Error("Gagal memuat data");
  return res.json();
};

const load = async () => {
  loading.value = true;
  try {
    const data = await fetchData(repo.value, state.value, page.value);
    prs.value = data.prs;
    repos.value = data.repos;
    total.value = data.total;
  } catch {
    toast.error("Gagal memuat data dari database");
  } finally {
    loading.value = false;
  }
};

watch([repo, state, page], load);
onMounted(load);

const refresh = async () => {
  refreshing.value = true;
  try {
    const res = await fetch("/api/collect", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Collect gagal");
      return;
    }
    toast.success(
      `Collect selesai: ${data.repos} repo, ${data.prs} PR` +
      (data.errors?.length ? `, ${data.errors.length} error` : ""),
    );
    const fresh = await fetchData(repo.value, state.value, page.value);
    prs.value = fresh.prs;
    repos.value = fresh.repos;
    total.value = fresh.total;
  } catch {
    toast.error("Gagal refresh data");
  } finally {
    refreshing.value = false;
  }
};

const handleStateChange = (id: number, newState: PR["state"]) => {
  prs.value = prs.value.map((p) => (p.id === id ? { ...p, state: newState } : p));
};
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Dashboard Monitoring</h1>
      <p class="text-sm text-muted-foreground">
        Pull request open dari repo yang bisa diakses ({{ repos.length }} repo, {{ prs.length }} PR)
      </p>
    </div>
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
    <PrTable :prs="prs" :loading="loading" :on-state-change="handleStateChange" />
    <div class="flex items-center justify-between">
      <span class="text-sm text-muted-foreground">{{ prs.length }} dari {{ total }} PR</span>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="page <= 1" @click="page = Math.max(1, page - 1)">
          ← Sebelumnya
        </Button>
        <span class="text-sm text-muted-foreground">Hal {{ page }} / {{ totalPages }}</span>
        <Button variant="outline" size="sm" :disabled="page >= totalPages"
          @click="page = Math.min(totalPages, page + 1)">
          Berikutnya →
        </Button>
      </div>
    </div>
  </div>
</template>
