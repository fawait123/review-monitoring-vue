import { ref, computed } from "vue";
import type { PR, Review, ReviewComment } from "~~/shared/types";
import type { ReviewMode, LogLine } from "./useReview";

export function useReviewState(options: {
  pr: PR;
  reviews: Review[];
  commentsByReview: Record<number, ReviewComment[]>;
}) {
  const { reviews, commentsByReview } = options;

  const draft = reviews.find((r) => r.status === "draft");
  const submittedReviews = reviews.filter((r) => r.status === "submitted");

  const mode = ref<ReviewMode>(submittedReviews.length > 0 ? "submitted" : draft ? "editing" : "idle");
  const activeReviewId = ref<number | null>(draft?.id ?? null);
  const summary = ref<string>(draft?.summary ?? submittedReviews[0]?.summary ?? "");
  const comments = ref<ReviewComment[]>(activeReviewId.value ? commentsByReview[activeReviewId.value] ?? [] : []);
  const log = ref<LogLine[]>([]);
  const editingId = ref<number | null>(null);
  const editBody = ref("");
  const openThread = ref<{ path: string; line: number } | null>(null);
  const submitting = ref(false);
  const abortRef = ref<AbortController | null>(null);
  const excludedPaths = ref<string[]>([]);

  const pushLog = (line: LogLine) => {
    log.value = [...log.value, line];
  };

  const totalExclude = computed(() => excludedPaths.value.length);

  const toggleExclude = (path: string, checked: boolean) => {
    if (checked) {
      if (!excludedPaths.value.includes(path)) {
        excludedPaths.value.push(path);
      }
    } else {
      excludedPaths.value = excludedPaths.value.filter((p) => p !== path);
    }
  };

  return {
    mode,
    activeReviewId,
    summary,
    comments,
    log,
    editingId,
    editBody,
    openThread,
    submitting,
    abortRef,
    excludedPaths,
    totalExclude,
    pushLog,
    toggleExclude,
  };
}
