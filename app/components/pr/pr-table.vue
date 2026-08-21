<script setup lang="ts">
import { MoreHorizontalIcon } from "@lucide/vue";
import type { PR } from "~~/shared/types";
import PrStatusBadge from "./pr-status-badge.vue";
import ReviewDecisionBadge from "./review-decision-badge.vue";
import DiffStat from "./diff-stat.vue";

const props = defineProps<{
  prs: PR[];
  loading?: boolean;
  onStateChange?: (p: PR, state: PR["state"]) => void;
}>();

const emit = defineEmits<{
  "state-change": [pr: PR, state: PR["state"]];
}>();

const handleStateChange = (p: PR, state: PR["state"]) => {
  if (props.onStateChange) {
    props.onStateChange(p, state);
  } else {
    emit("state-change", p, state);
  }
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
</script>

<template>
  <div>
    <div v-if="loading" class="space-y-2">
      <Skeleton v-for="i in 6" :key="i" class="h-10 w-full" />
    </div>
    <div v-else class="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-16">#</TableHead>
            <TableHead>Repo</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Author</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Review</TableHead>
            <TableHead class="text-right">Diff</TableHead>
            <TableHead class="text-right">Updated</TableHead>
            <TableHead class="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="p in prs" :key="p.id" class="cursor-pointer hover:bg-muted/50">
            <TableCell class="font-mono text-muted-foreground">{{ p.number }}</TableCell>
            <TableCell class="font-mono text-xs text-muted-foreground">{{ p.repo }}</TableCell>
            <TableCell>
              <NuxtLink
                :to="`/pr/${p.repo}/${p.number}`"
                class="hover:underline text-sm line-clamp-1 max-w-80 truncate inline-block"
              >
                {{ p.title }}
              </NuxtLink>
            </TableCell>
            <TableCell class="text-sm">{{ p.authorLogin }}</TableCell>
            <TableCell>
              <PrStatusBadge :state="p.state" />
            </TableCell>
            <TableCell>
              <ReviewDecisionBadge :decision="p.reviewDecision" :draft="p.isDraft" />
            </TableCell>
            <TableCell class="text-right">
              <DiffStat :additions="p.additions" :deletions="p.deletions" />
            </TableCell>
            <TableCell class="text-right text-xs text-muted-foreground whitespace-nowrap">
              {{ fmtDate(p.updatedAt) }}
            </TableCell>
            <TableCell class="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger
                  class="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                  aria-label="Ubah state PR"
                >
                  <MoreHorizontalIcon class="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem :disabled="p.state === 'OPEN'" @select="handleStateChange(p, 'OPEN')">
                    Tandai Open
                  </DropdownMenuItem>
                  <DropdownMenuItem :disabled="p.state === 'MERGED'" @select="handleStateChange(p, 'MERGED')">
                    Tandai Merged
                  </DropdownMenuItem>
                  <DropdownMenuItem :disabled="p.state === 'CLOSED'" @select="handleStateChange(p, 'CLOSED')">
                    Tandai Closed
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
          <TableRow v-if="prs.length === 0">
            <TableCell colSpan="9" class="h-24 text-center text-muted-foreground">
              Belum ada PR. Klik <b>Refresh</b> untuk mengumpulkan dari GitHub.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
