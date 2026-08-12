<script setup lang="ts">
import { toast } from "vue-sonner";

interface CatalogModel {
  id: string;
  name: string;
  reasoning: boolean;
  available: boolean;
}
interface CatalogProvider {
  id: string;
  name: string;
  models: CatalogModel[];
}

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

const providers = ref<CatalogProvider[]>([]);
const loading = ref(true);
const saving = ref(false);

const providerId = ref("");
const modelId = ref("");
const thinkingLevel = ref("medium");
const saved = ref<{ providerId: string; modelId: string; thinkingLevel: string } | null>(null);

const modelOptions = computed(() => providers.value.find((p) => p.id === providerId.value)?.models ?? []);

async function load() {
  loading.value = true;
  try {
    const [cat, cfg] = await Promise.all([
      fetch("/api/model/catalog").then((r) => r.json()),
      fetch("/api/model/config").then((r) => r.json()),
    ]);
    providers.value = cat.providers ?? [];
    if (cfg?.providerId) {
      providerId.value = cfg.providerId;
      modelId.value = cfg.modelId;
      thinkingLevel.value = cfg.thinkingLevel ?? "medium";
      saved.value = cfg;
    } else if (providers.value.length > 0) {
      providerId.value = providers.value[0]!.id;
    }
  } catch (e: any) {
    toast.error(e?.message ?? "Gagal memuat catalog model");
  } finally {
    loading.value = false;
  }
}

// Ganti provider → reset model ke yg tersedia pertama.
// Skip kalau modelId masih valid (mis. waktu load dari DB biar autoselect tersimpan).
watch(providerId, () => {
  const opts = modelOptions.value;
  if (opts.some((m) => m.id === modelId.value)) return;
  const first = opts.find((m) => m.available) ?? opts[0];
  modelId.value = first?.id ?? "";
});

async function save() {
  if (!providerId.value || !modelId.value) {
    toast.error("Pilih provider dan model dulu");
    return;
  }
  saving.value = true;
  try {
    const res = await fetch("/api/model/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: providerId.value,
        modelId: modelId.value,
        thinkingLevel: thinkingLevel.value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Gagal simpan config");
    saved.value = data;
    toast.success(`Model aktif: ${data.providerId}/${data.modelId}`);
  } catch (e: any) {
    toast.error(e?.message ?? "Gagal simpan config model");
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Konfigurasi Model Pi SDK</CardTitle>
        <CardDescription>
          Pilih model yang dipakai agent untuk review PR. Definisi provider ada di
          <code>server/config/models.json</code>; API key lewat env (<code>$OLLAMA_API_KEY</code> dll).
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div v-if="loading" class="py-8 text-center text-sm text-muted-foreground">
          Memuat catalog model…
        </div>
        <template v-else>
          <div class="space-y-2">
            <div class="text-sm font-medium">Provider</div>
            <Select v-model="providerId">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Pilih provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in providers" :key="p.id" :value="p.id">
                  {{ p.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Model</div>
            <Select v-model="modelId" :disabled="modelOptions.length === 0">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Pilih model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="m in modelOptions" :key="m.id" :value="m.id">
                  <span class="flex items-center gap-2">
                    {{ m.name }}
                    <Badge v-if="m.available" variant="default">tersedia</Badge>
                    <Badge v-else variant="secondary">tidak tersedia</Badge>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">
              Model tanpa API key (env) ditandai "tidak tersedia" dan tidak bisa dipakai review.
            </p>
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Thinking level</div>
            <Select v-model="thinkingLevel">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="lvl in THINKING_LEVELS" :key="lvl" :value="lvl">
                  {{ lvl }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div v-if="saved" class="text-xs text-muted-foreground">
            Tersimpan: {{ saved.providerId }}/{{ saved.modelId }} · thinking {{ saved.thinkingLevel }}
          </div>

          <Button class="w-full" :disabled="saving || !providerId || !modelId" @click="save">
            {{ saving ? "Menyimpan…" : "Simpan Config Model" }}
          </Button>
        </template>
      </CardContent>
    </Card>
  </div>
</template>