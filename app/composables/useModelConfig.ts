import { ref, computed, watch, onMounted } from "vue";
import { toast } from "vue-sonner";

export interface CatalogModel {
  id: string;
  name: string;
  reasoning: boolean;
  available: boolean;
}

export interface CatalogProvider {
  id: string;
  name: string;
  models: CatalogModel[];
}

export interface SavedModelConfig {
  providerId: string;
  modelId: string;
  thinkingLevel: string;
}

export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

export function useModelConfig() {
  const providers = ref<CatalogProvider[]>([]);
  const loading = ref(true);
  const saving = ref(false);

  const providerId = ref("");
  const modelId = ref("");
  const thinkingLevel = ref<string>("medium");
  const saved = ref<SavedModelConfig | null>(null);

  const modelOptions = computed<CatalogModel[]>(
    () => providers.value.find((p) => p.id === providerId.value)?.models ?? [],
  );

  const load = async () => {
    loading.value = true;
    try {
      const [cat, cfg] = await Promise.all([
        $fetch<{ providers: CatalogProvider[] }>("/api/model/catalog"),
        $fetch<SavedModelConfig | null>("/api/model/config"),
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal memuat catalog model";
      toast.error(msg);
    } finally {
      loading.value = false;
    }
  };

  // Ganti provider → reset model ke yg tersedia pertama jika model saat ini tidak valid
  watch(providerId, () => {
    const opts = modelOptions.value;
    if (opts.some((m) => m.id === modelId.value)) return;
    const first = opts.find((m) => m.available) ?? opts[0];
    modelId.value = first?.id ?? "";
  });

  const save = async () => {
    if (!providerId.value || !modelId.value) {
      toast.error("Pilih provider dan model dulu");
      return;
    }
    saving.value = true;
    try {
      const data = await $fetch<SavedModelConfig>("/api/model/config", {
        method: "PUT",
        body: {
          providerId: providerId.value,
          modelId: modelId.value,
          thinkingLevel: thinkingLevel.value,
        },
      });
      saved.value = data;
      toast.success(`Model aktif: ${data.providerId}/${data.modelId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal simpan config model";
      toast.error(msg);
    } finally {
      saving.value = false;
    }
  };

  onMounted(load);

  return {
    providers,
    modelOptions,
    providerId,
    modelId,
    thinkingLevel,
    saved,
    loading,
    saving,
    thinkingLevels: THINKING_LEVELS,
    load,
    save,
  };
}
