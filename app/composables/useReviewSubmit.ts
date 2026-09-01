import { toast } from "vue-sonner";
import type { Ref } from "vue";
import type { ReviewMode } from "./useReview";

export function useReviewSubmit(options: {
  activeReviewId: Ref<number | null>;
  summary: Ref<string>;
  mode: Ref<ReviewMode>;
  submitting: Ref<boolean>;
  onSubmitted?: () => void;
}) {
  const { activeReviewId, summary, mode, submitting, onSubmitted } = options;

  const saveSummary = async () => {
    if (!activeReviewId.value) return;
    try {
      await $fetch(`/api/reviews/${activeReviewId.value}`, {
        method: "PUT",
        body: { summary: summary.value },
      });
      toast.success("Summary disimpan");
    } catch {
      toast.error("Gagal simpan summary");
    }
  };

  const submit = async () => {
    if (!activeReviewId.value) return;
    submitting.value = true;
    try {
      const data = await $fetch<{ comments: number; dropped: number }>(
        `/api/reviews/${activeReviewId.value}/submit`,
        { method: "POST" },
      );
      toast.success(`Review disubmit ke GitHub (${data.comments} komentar)`);
      if (data.dropped > 0) {
        toast.warning(`${data.dropped} komentar tak bisa dipasang (diff PR berubah) — dicatat di summary`);
      }
      mode.value = "submitted";
      onSubmitted?.();
    } catch {
      toast.error("Submit gagal");
    } finally {
      submitting.value = false;
    }
  };

  return { saveSummary, submit };
}
