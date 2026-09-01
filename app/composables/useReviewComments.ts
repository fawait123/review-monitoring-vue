import { toast } from "vue-sonner";
import type { ReviewComment } from "~~/shared/types";
import type { Ref } from "vue";

export function useReviewComments(options: {
  activeReviewId: Ref<number | null>;
  comments: Ref<ReviewComment[]>;
  editingId: Ref<number | null>;
  editBody: Ref<string>;
  openThread: Ref<{ path: string; line: number } | null>;
}) {
  const { activeReviewId, comments, editingId, editBody, openThread } = options;

  const addComment = async (path: string, line: number, body: string) => {
    if (!activeReviewId.value) return;
    try {
      const data = await $fetch<{ comment: ReviewComment }>(`/api/reviews/${activeReviewId.value}/comments`, {
        method: "POST",
        body: { path, line, body },
      });
      comments.value = [...comments.value, data.comment];
      toast.success("Komentar ditambahkan");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal tambah komentar";
      toast.error(msg);
      throw err;
    }
  };

  const startEditComment = (c: ReviewComment) => {
    editingId.value = c.id;
    editBody.value = c.body;
    openThread.value = { path: c.path, line: c.line };
  };

  const cancelEditComment = () => {
    editingId.value = null;
    editBody.value = "";
  };

  const saveEdit = async (c: ReviewComment) => {
    try {
      await $fetch(`/api/comments/${c.id}`, {
        method: "PUT",
        body: { body: editBody.value },
      });
      comments.value = comments.value.map((x) => (x.id === c.id ? { ...x, body: editBody.value } : x));
      editingId.value = null;
      toast.success("Komentar diperbarui");
    } catch {
      toast.error("Gagal simpan");
    }
  };

  const removeComment = async (id: number) => {
    if (!confirm("Hapus komentar ini?")) return;
    try {
      await $fetch(`/api/comments/${id}`, { method: "DELETE" });
      comments.value = comments.value.filter((x) => x.id !== id);
      toast.success("Komentar dihapus");
    } catch {
      toast.error("Gagal hapus komentar");
    }
  };

  return { addComment, startEditComment, cancelEditComment, saveEdit, removeComment };
}
