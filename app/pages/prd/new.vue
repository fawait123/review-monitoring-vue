<script setup lang="ts">
import { ref } from "vue";
import { SparklesIcon, ListChecksIcon } from "@lucide/vue";
import { toast } from "vue-sonner";
import { usePrd } from "~/composables/usePrd";
import type { Prd, PrdTask, PrdStackInput, PrdStackField } from "~~/shared/types";
import { PRD_STACK_FIELDS } from "~~/shared/types";

useHead({ title: "New PRD" });
const { createStream, breakdown } = usePrd();
const router = useRouter();

const prompt = ref("");
const stack = ref<PrdStackInput>({});
const content = ref("");
const generating = ref(false);
const breaking = ref(false);
const prdId = ref<number | null>(null);
const tasks = ref<PrdTask[]>([]);

const hasStack = () => Object.values(stack.value).some((v) => v?.trim());

const stackPlaceholder: Record<PrdStackField, string> = {
  frontend: "nuxtjs / react / vue",
  backend: "golang / nodejs / laravel",
  database: "postgresql / mysql / mongodb",
  server: "vps manual / docker / vercel",
};

const generate = async () => {
  if (!prompt.value.trim()) return toast.warning("Tulis ide terlebih dahulu");
  if (!hasStack()) return toast.warning("Isi minimal satu stack teknologi");
  generating.value = true;
  content.value = "";
  try {
    const prd = await createStream(prompt.value.trim(), stack.value, (delta) => {
      content.value += delta;
    });
    prdId.value = prd.id;
  } catch (err: unknown) {
    const msg =
      err && typeof err === "object" && "message" in err
        ? (err as { message?: string }).message
        : undefined;
    toast.error(msg ?? "Gagal generate PRD");
  } finally {
    generating.value = false;
  }
};

const doBreakdown = async () => {
  if (!prdId.value) return;
  breaking.value = true;
  try {
    tasks.value = await breakdown(prdId.value);
  } catch {
    toast.error("Gagal breakdown tasks");
  } finally {
    breaking.value = false;
  }
};

const goDetail = () => router.push(`/prd/${prdId.value}`);
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">PRD Baru</h1>
      <p class="text-sm text-muted-foreground">Pilih stack → tulis ide → generate (streaming) → pecah jadi tasks</p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Stack Teknologi</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <div v-for="f in PRD_STACK_FIELDS" :key="f" class="grid grid-cols-[110px_1fr] items-center gap-3">
          <label class="text-sm font-medium capitalize">{{ f }}</label>
          <Input v-model="stack[f as PrdStackField]" :placeholder="`contoh: ${stackPlaceholder[f as PrdStackField]}`" />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Ide / Persyaratan Produk</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <Textarea v-model="prompt" rows="5" placeholder="Contoh: Aplikasi todo list dengan fitur kolaborasi realtime, prioritas, dan reminder…" />
        <Button :disabled="generating" @click="generate">
          <SparklesIcon class="size-4" /> {{ generating ? "Mengenerate…" : "Generate PRD" }}
        </Button>
      </CardContent>
    </Card>

    <template v-if="content">
      <Card>
        <CardHeader class="flex-row items-center justify-between space-y-0">
          <CardTitle class="text-sm">{{ generating ? "Mengenerate (streaming)…" : "PRD" }}</CardTitle>
          <Button v-if="!generating" variant="outline" :disabled="breaking" @click="doBreakdown">
            <ListChecksIcon class="size-4" /> {{ breaking ? "Memecah…" : "Breakdown Tasks" }}
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea v-model="content" :readonly="generating" rows="18" class="font-mono text-xs" />
        </CardContent>
      </Card>
    </template>

    <template v-if="tasks.length">
      <Card>
        <CardHeader><CardTitle class="text-sm">Tasks ({{ tasks.length }})</CardTitle></CardHeader>
        <CardContent>
          <ul class="space-y-2">
            <li v-for="(t, i) in tasks" :key="i" class="rounded-lg border p-3 text-sm">
              <p class="font-medium">{{ i + 1 }}. {{ t.title }}</p>
              <p class="text-muted-foreground">{{ t.description }}</p>
            </li>
          </ul>
          <div class="mt-4">
            <Button @click="goDetail">Lanjut ke Detail / Push</Button>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
