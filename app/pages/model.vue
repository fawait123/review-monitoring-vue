<script setup lang="ts">
import { useModelConfig } from "~/composables/useModelConfig";

const {
  providers,
  modelOptions,
  providerId,
  modelId,
  thinkingLevel,
  saved,
  loading,
  saving,
  thinkingLevels,
  save,
} = useModelConfig();
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
                <SelectItem v-for="lvl in thinkingLevels" :key="lvl" :value="lvl">
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