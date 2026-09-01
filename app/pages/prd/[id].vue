<script setup lang="ts">
import { ref, computed } from "vue";
import { ExternalLinkIcon, SaveIcon, GitPullRequestIcon } from "@lucide/vue";
import { toast } from "vue-sonner";
import { usePrd } from "~/composables/usePrd";
import type { Prd, PrdTask, PrdTaskStatus } from "~~/shared/types";

const route = useRoute();
const id = Number(route.params.id);
useHead({ title: "PRD Detail" });

const { get, update, updateTask, push, listRepos } = usePrd();
const { data, error, refresh } = await useAsyncData(`prd-${id}`, () => get(id));

const prd = computed<Prd | null>(() => data.value?.prd ?? null);
const tasks = ref<PrdTask[]>(data.value?.tasks ?? []);
const editingContent = ref(data.value?.prd.content ?? "");
const editingTitle = ref(data.value?.prd.title ?? "");
const saving = ref(false);

const repos = ref<string[]>([]);
const repo = ref("");
const pushing = ref(false);
const loadRepos = async () => {
  try {
    repos.value = await listRepos();
  } catch (err: unknown) {
    toast.error((err as { data?: { error?: string } })?.data?.error ?? "Gagal memuat repo (login gh dulu?)");
  }
};

const savePrd = async () => {
  if (!prd.value) return;
  saving.value = true;
  try {
    const updated = await update(id, { title: editingTitle.value, content: editingContent.value });
    editingTitle.value = updated.title;
    editingContent.value = updated.content;
    toast.success("PRD tersimpan");
  } catch {
    toast.error("Gagal menyimpan PRD");
  } finally {
    saving.value = false;
  }
};

const saveTask = async (t: PrdTask) => {
  await updateTask(t.id, {
    title: t.title,
    description: t.description,
    acceptanceCriteria: t.acceptanceCriteria,
    status: t.status,
  });
  toast.success("Task tersimpan");
};

const setTaskStatus = async (t: PrdTask, s: string) => {
  t.status = s as PrdTaskStatus;
  await saveTask(t);
};

const doPush = async () => {
  if (!prd.value) return;
  if (!repo.value) return toast.warning("Pilih repo tujuan");
  pushing.value = true;
  try {
    const res = await push(id, { repo: repo.value });
    toast.success(`PR #${res.pr.number} dibuat (PRD + ${res.taskCount} task)`);
    editingTitle.value = prd.value.title;
    await refresh();
  } catch (err: unknown) {
    toast.error((err as { data?: { error?: string } })?.data?.error ?? "Gagal push ke GitHub");
  } finally {
    pushing.value = false;
  }
};
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div v-if="error">
      <h1 class="text-2xl font-bold text-destructive">Gagal memuat PRD</h1>
      <p class="text-muted-foreground">{{ error.message }}</p>
    </div>

    <template v-else-if="prd">
      <div class="flex items-center justify-between">
        <NuxtLink to="/prd" class="text-sm text-muted-foreground hover:underline">← Kembali</NuxtLink>
        <span class="flex items-center gap-2">
          <Badge variant="outline">{{ prd.status }}</Badge>
          <Badge v-if="(prd.repoNameWithOwner)" variant="secondary">{{ prd.repoNameWithOwner }}</Badge>
        </span>
      </div>

      <Card>
        <CardHeader><CardTitle class="text-sm">Judul PRD</CardTitle></CardHeader>
        <CardContent>
          <Input v-model="editingTitle" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex-row items-center justify-between space-y-0">
          <CardTitle class="text-sm">Content PRD</CardTitle>
          <Button variant="outline" size="sm" :disabled="saving" @click="savePrd">
            <SaveIcon class="size-4" /> {{ saving ? "Menyimpan…" : "Simpan" }}
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea v-model="editingContent" rows="24" class="font-mono text-xs" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle class="text-sm">Tasks ({{ tasks.length }})</CardTitle></CardHeader>
        <CardContent class="space-y-4">
          <div
            v-for="(t, i) in tasks"
            :key="t.id"
            class="space-y-2 rounded-lg border p-3"
          >
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">{{ i + 1 }}.</span>
              <Input v-model="t.title" class="flex-1 font-medium" />
              <select
                :value="t.status"
                class="h-9 rounded-md border bg-transparent px-2 text-sm"
                @change="setTaskStatus(t, ($event.target as any).value)"
              >
                <option value="todo">todo</option>
                <option value="in_progress">in_progress</option>
                <option value="done">done</option>
              </select>
            </div>
            <Textarea v-model="t.description" rows="2" placeholder="Deskripsi" @blur="saveTask(t)" />
            <Textarea v-model="t.acceptanceCriteria" rows="2" placeholder="Acceptance criteria" @blur="saveTask(t)" />
          </div>
          <p v-if="tasks.length === 0" class="text-sm text-muted-foreground">
            Belum ada task. Buka halaman <i>New PRD</i> & jalankan Breakdown, atau buat task di sini nanti.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle class="text-sm">Push ke GitHub</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <p class="text-sm text-muted-foreground">
            PRD jadi <b>PR</b>: file <code>docs/prd/&lt;slug&gt;.md</code> (PRD) + <code>docs/prd/&lt;slug&gt;-tasks.md</code> (task breakdown, structured) di folder <code>docs/prd/</code>.
          </p>
          <div class="flex items-center gap-2">
            <select
              v-model="repo"
              class="h-9 flex-1 rounded-md border bg-transparent px-2 text-sm"
            >
              <option value="" disabled>Pilih repo…</option>
              <option v-for="r in repos" :key="r" :value="r">{{ r }}</option>
            </select>
            <Button variant="outline" size="sm" @click="loadRepos">Muat repo</Button>
          </div>

          <div v-if="prd.ghPrUrl" class="text-sm">
            <Badge variant="default" as-child>
              <a :href="prd.ghPrUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-1">
                PR #{{ prd.ghPrNumber }} <ExternalLinkIcon class="size-3" />
              </a>
            </Badge>
          </div>

          <div class="flex items-center gap-2">
            <Button :disabled="pushing || prd.status === 'pushed'" @click="doPush">
              <GitPullRequestIcon class="size-4" />
              {{ pushing ? "Mempush…" : prd.status === "pushed" ? "Sudah di-push" : "Push ke GitHub" }}
            </Button>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
