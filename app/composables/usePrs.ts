import { ref, computed, watch, onMounted } from "vue";
import { toast } from "vue-sonner";
import type { PR } from "~~/shared/types";

export const PAGE_SIZE = 20;

export function usePrs() {
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

    return $fetch<{ prs: PR[]; repos: string[]; total: number }>(`/api/collect?${q.toString()}`);
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

  const refresh = async () => {
    refreshing.value = true;
    try {
      const data = await $fetch<{ repos: number; prs: number; errors?: string[] }>("/api/collect", {
        method: "POST",
      });
      toast.success(
        `Collect selesai: ${data.repos} repo, ${data.prs} PR` +
          (data.errors?.length ? `, ${data.errors.length} error` : ""),
      );
      const fresh = await fetchData(repo.value, state.value, page.value);
      prs.value = fresh.prs;
      repos.value = fresh.repos;
      total.value = fresh.total;
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "data" in err && (err as { data?: { error?: string } }).data?.error
        ? (err as { data: { error: string } }).data.error
        : "Gagal refresh data";
      toast.error(msg);
    } finally {
      refreshing.value = false;
    }
  };

  const changeState = async (p: PR, newState: PR["state"]) => {
    try {
      await $fetch(`/api/prs/${p.id}/state`, {
        method: "POST",
        body: { state: newState },
      });
      prs.value = prs.value.map((item) => (item.id === p.id ? { ...item, state: newState } : item));
      toast.success(`PR #${p.number} → ${newState}`);
    } catch {
      toast.error("Gagal update state");
    }
  };

  watch([repo, state, page], load);
  onMounted(load);

  return {
    prs,
    repos,
    repo,
    state,
    page,
    total,
    totalPages,
    loading,
    refreshing,
    load,
    refresh,
    changeState,
  };
}
