<script setup lang="ts">
import { onMounted } from "vue";
import { PlusIcon, FileTextIcon } from "@lucide/vue";
import { usePrd } from "~/composables/usePrd";
import type { Prd } from "~~/shared/types";

useHead({ title: "PRD" });
const { prds, loading, list } = usePrd();
onMounted(list);

const statusVariant = (s: Prd["status"]) =>
  s === "pushed" ? "default" : s === "generated" ? "secondary" : "outline";
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">PRD</h1>
        <p class="text-sm text-muted-foreground">Generate PRD & pecah jadi tasks untuk di-push ke GitHub</p>
      </div>
      <Button as-child>
        <NuxtLink to="/prd/new"><PlusIcon class="size-4" /> New PRD</NuxtLink>
      </Button>
    </div>

    <div v-if="loading" class="text-sm text-muted-foreground">Memuat…</div>

    <div v-else-if="prds.length === 0" class="text-sm text-muted-foreground">
      Belum ada PRD. Klik <b>New PRD</b> untuk mulai.
    </div>

    <div v-else class="grid gap-4">
      <NuxtLink v-for="p in prds" :key="p.id" :to="`/prd/${p.id}`">
        <Card class="hover:bg-accent/50 transition-colors">
          <CardContent class="flex items-center justify-between p-4">
            <div class="flex items-center gap-3 min-w-0">
              <FileTextIcon class="size-5 shrink-0 text-muted-foreground" />
              <div class="min-w-0">
                <p class="truncate font-medium">{{ p.title }}</p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ p.taskCount }} task · {{ p.repoNameWithOwner ?? "belum ada repo" }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <Badge v-if="p.ghPrUrl" variant="default" as-child>
                <a :href="p.ghPrUrl" target="_blank" rel="noopener" @click.stop>PR #{{ p.ghPrNumber }}</a>
              </Badge>
              <Badge :variant="statusVariant(p.status)">{{ p.status }}</Badge>
            </div>
          </CardContent>
        </Card>
      </NuxtLink>
    </div>
  </div>
</template>
