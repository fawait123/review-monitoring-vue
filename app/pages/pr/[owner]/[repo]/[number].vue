<script setup lang="ts">
import DiffStat from "~/components/pr/diff-stat.vue";
import PrStatusBadge from "~/components/pr/pr-status-badge.vue";
import ReviewDecisionBadge from "~/components/pr/review-decision-badge.vue";
import ReviewWorkspace from "~/components/review/review-workspace.vue";
import { parseDiff } from "~~/shared/diff-parser";
import type { DiffFile, PR, Review, ReviewComment } from "~~/shared/types";

const route = useRoute();
const owner = String(route.params.owner);
const repo = String(route.params.repo);
const number = Number(route.params.number);

interface PrDetailData {
  pr: PR;
  reviews: { review: Review; comments: ReviewComment[] }[];
  reviewerName: string;
  diff?: string;
  baseRef?: string;
  headRef?: string;
  diffError?: string | null;
}

const { data, pending, error, refresh } = useAsyncData(
  `pr-${owner}-${repo}-${number}`,
  () => $fetch<PrDetailData>(`/api/prs/${owner}/${repo}/${number}?includeDiff=1`),
);

const files = computed<DiffFile[]>(() => (data.value?.diff ? parseDiff(data.value.diff) : []));

const reviews = computed<Review[]>(() => data.value?.reviews.map((r) => r.review) ?? []);
const commentsByReview = computed<Record<number, ReviewComment[]>>(() => {
  const map: Record<number, ReviewComment[]> = {};
  for (const r of data.value?.reviews ?? []) map[r.review.id] = r.comments;
  return map;
});
</script>

<template>
  <div class="space-y-6 max-w-dvw">
    <div v-if="error">
      <h1 class="text-2xl font-bold">PR belum ter-<i>collect</i></h1>
      <p class="text-muted-foreground">
        {{ error.statusCode === 404 ? (error.data as { error?: string } | null)?.error ?? `PR ${owner}/${repo}#${number}
        belum ada di database lokal.` : error.message }}
      </p>
      <Button variant="outline" class="mt-4">
        <NuxtLink to="/">← Dashboard</NuxtLink>
      </Button>
    </div>

    <template v-else-if="pending">
      <div class="flex flex-col items-center justify-center py-32 gap-3">
        <div class="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p class="text-sm text-muted-foreground">Memuat detail PR…</p>
      </div>
    </template>

    <template v-else-if="data">
      <div>
        <NuxtLink to="/" class="text-sm text-muted-foreground hover:text-foreground">
          ← Dashboard
        </NuxtLink>
        <div class="flex items-start justify-between gap-4 mt-2 flex-wrap">
          <div class="min-w-0">
            <h1 class="text-xl font-bold tracking-tight wrap-break-word">
              {{ data.pr.title }}
              <span class="text-muted-foreground font-mono text-base"> #{{ data.pr.number }}</span>
            </h1>
            <p class="text-sm text-muted-foreground mt-1">
              <span class="font-mono">{{ data.pr.repo }}</span> · oleh <b>{{ data.pr.authorLogin }}</b>
              <span v-if="data.baseRef && data.headRef" class="font-mono"> · {{ data.baseRef }} ← {{ data.headRef
                }}</span>
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <PrStatusBadge :state="data.pr.state" />
            <ReviewDecisionBadge :decision="data.pr.reviewDecision" :draft="data.pr.isDraft" />
            <DiffStat :additions="data.pr.additions" :deletions="data.pr.deletions" />
          </div>
        </div>
      </div>

      <div v-if="data.diffError" class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        Gagal mengambil diff: {{ data.diffError }}
      </div>

      <ReviewWorkspace v-if="!data.diffError" :pr="data.pr" :files="files" :reviews="reviews"
        :comments-by-review="commentsByReview" :reviewer-name="data.reviewerName" @submitted="refresh()" />
    </template>
  </div>
</template>
