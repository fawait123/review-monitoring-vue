<script setup lang="ts">
import type { DiffFile, PR, Review, ReviewComment } from "~~/shared/types";
import { useReview } from "~/composables/useReview";
import ReviewThread from "./review-thread.vue";
import ReviewTerminal from "./review-terminal.vue";
import DiffViewer from "../diff/diff-viewer.vue";

const props = defineProps<{
  pr: PR;
  files: DiffFile[];
  reviews: Review[];
  commentsByReview: Record<number, ReviewComment[]>;
  reviewerName: string;
}>();

const emit = defineEmits<{ submitted: [] }>();

const {
  mode,
  summary,
  comments,
  log,
  editingId,
  editBody,
  openThread,
  submitting,
  runReview,
  cancelRun,
  addComment,
  startEditComment,
  cancelEditComment,
  saveEdit,
  removeComment,
  saveSummary,
  submit,
  toggleExclude,
  totalExclude,
  excludedPaths
} = useReview({
  pr: props.pr,
  reviews: props.reviews,
  commentsByReview: props.commentsByReview,
  onSubmitted: () => emit("submitted"),
});
</script>

<template>
  <div class="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
    <div class="min-w-0">
      <DiffViewer :excluded-files="excludedPaths" :submitted="mode === 'submitted'" :files="files" :comments="comments"
        :reviewer-name="reviewerName" :open-thread="openThread" :editing-id="editingId" :edit-body="editBody"
        @open-thread="openThread = $event" @add-comment="addComment" @edit-body="editBody = $event"
        @edit="startEditComment" @save-edit="saveEdit" @cancel-edit="cancelEditComment" @delete="removeComment"
        @toggle-exclude="toggleExclude" />
    </div>

    <div class="space-y-4 lg:sticky lg:top-6">
      <!-- Mode Idle -->
      <div v-if="mode === 'idle'" class="rounded-lg border p-4 space-y-3">
        <h3 class="font-semibold text-sm">Review dengan Pi agent</h3>
        <p class="text-xs text-muted-foreground">
          Pi agent menganalisis diff dan menghasilkan draft komentar review. Kamu bisa edit sebelum submit ke GitHub.
          Kamu bisa memilih file untuk tidak dilakukan review, Total <span class="font-bold text-sky-400">{{
            totalExclude }}</span> dari <span class="font-bold text-sky-400">{{
              files.length }}</span> file tidak di lakukan review
        </p>
        <Button class="w-full" @click="runReview">▶ Jalankan Review</Button>
      </div>

      <!-- Mode Running (Terminal Log) -->
      <ReviewTerminal v-if="mode === 'running'" :log="log" @cancel="cancelRun" />

      <!-- Mode Editing -->
      <div v-if="mode === 'editing'"
        class="space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto pr-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
        <div class="rounded-lg border p-4 space-y-3">
          <h3 class="font-semibold text-sm">Summary review</h3>
          <Textarea v-model="summary" rows="6" placeholder="Ringkasan review level PR…" />
          <Button size="sm" variant="outline" class="w-full" @click="saveSummary">
            Simpan summary
          </Button>
        </div>

        <div class="rounded-lg border p-4 space-y-3">
          <h3 class="font-semibold text-sm">
            Komentar <span class="text-muted-foreground font-normal">({{ comments.length }})</span>
          </h3>
          <p v-if="comments.length === 0" class="text-xs text-muted-foreground">
            Belum ada komentar. Klik <b>+</b> pada baris di diff untuk menambah.
          </p>
          <div class="space-y-2">
            <ReviewThread :files="files" :comments="comments" :editing-id="editingId" :edit-body="editBody"
              :reviewer-name="reviewerName" @edit-body="editBody = $event" @save-edit="saveEdit"
              @cancel-edit="cancelEditComment" @edit="startEditComment" @delete="removeComment" />
          </div>
        </div>

        <Button class="w-full" :disabled="submitting || comments.filter((c) => c.body.trim()).length === 0"
          @click="submit">
          {{submitting ? "Mengirim…" : `🚀 Submit Review ke GitHub (${comments.filter((c) => c.body.trim()).length})`
          }}
        </Button>
        <Button variant="outline" class="w-full" @click="runReview">↻ Review Ulang</Button>
      </div>

      <!-- Mode Submitted -->
      <div v-if="mode === 'submitted'" class="rounded-lg border p-4 space-y-3">
        <h3 class="font-semibold text-sm text-emerald-400">✓ Review terkirim</h3>
        <p class="text-xs text-muted-foreground">Review sudah disubmit ke GitHub. Lihat di PR:</p>
        <Button variant="outline" class="w-full" as-child>
          <a :href="pr.url" target="_blank" rel="noreferrer">Buka di GitHub ↗</a>
        </Button>
        <Button variant="outline" class="w-full" @click="runReview">↻ Review Ulang</Button>
      </div>
    </div>
  </div>
</template>
