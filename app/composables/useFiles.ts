import { ref } from "vue";
import type { FolderItem } from "~~/shared/types";

export function useFiles() {
  const items = ref<FolderItem[]>([]);
  const loading = ref(false);

  const list = async () => {
    loading.value = true;
    try {
      const data = await $fetch<{ items: FolderItem[] }>("/api/files");
      items.value = data.items;
    } finally {
      loading.value = false;
    }
  };

  const create = async (body: { parentId: number | null; kind: "folder" | "link"; name: string; url?: string }): Promise<FolderItem> => {
    const data = await $fetch<{ item: FolderItem }>("/api/files", { method: "POST", body });
    await list();
    return data.item;
  };

  // XHR (bukan $fetch) supaya progress upload byte bisa dilaporkan per-persen.
  const uploadFile = (
    parentId: number | null,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<FolderItem> =>
    new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("file", file);
      if (parentId !== null) form.append("parentId", String(parentId));
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/files/upload");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          let item: FolderItem | null = null;
          try {
            item = JSON.parse(xhr.responseText).item;
          } catch {
            reject(new Error("Respons upload tidak valid"));
            return;
          }
          list().then(() => resolve(item!));
        } else {
          let error = "Gagal upload file";
          try {
            error = JSON.parse(xhr.responseText).error ?? error;
          } catch {
            /* respons bukan JSON — pakai pesan default */
          }
          reject({ data: { error } });
        }
      };
      xhr.onerror = () => reject(new Error("Koneksi terputus saat upload"));
      xhr.send(form);
    });

  const patchItem = async (id: number, body: Partial<{ name: string; url: string; parentId: number | null }>): Promise<FolderItem> => {
    const data = await $fetch<{ item: FolderItem }>(`/api/files/${id}`, { method: "PUT", body });
    await list();
    return data.item;
  };

  const remove = async (id: number): Promise<void> => {
    await $fetch(`/api/files/${id}`, { method: "DELETE" });
    await list();
  };

  return { items, loading, list, create, uploadFile, patchItem, remove };
}
