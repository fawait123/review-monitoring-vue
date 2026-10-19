<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { toast } from "vue-sonner";
import { DownloadIcon, FolderPlusIcon, LinkIcon, UploadIcon } from "@lucide/vue";
import FolderTreeNodeItem from "~/components/files/folder-tree-node.vue";
import MoveItemDialog from "~/components/files/move-item-dialog.vue";
import { useFiles } from "~/composables/useFiles";
import { buildTree } from "~/utils/tree";
import type { FolderItem, FolderTreeNode } from "~~/shared/types";

const { items, loading, list, create, uploadFile, patchItem, remove } = useFiles();

const tree = computed(() => buildTree(items.value));

const selectedFolderId = ref<number | null>(null);
const currentPath = computed<string[]>(() => {
  if (selectedFolderId.value === null) return ["Akar (/)"];
  const byId = new Map<number, FolderItem>(items.value.map((i) => [i.id, i]));
  const names: string[] = [];
  let cur: FolderItem | undefined = byId.get(selectedFolderId.value);
  while (cur) {
    names.unshift(cur.name);
    cur = cur.parentId !== null ? byId.get(cur.parentId) : undefined;
  }
  return ["Akar (/)", ...names];
});

const showError = (err: unknown, fallback: string) => {
  const msg = (err as { data?: { error?: string } })?.data?.error;
  toast.error(msg || fallback);
};

const onSelect = (node: FolderTreeNode) => {
  selectedFolderId.value = node.kind === "folder" ? node.id : node.parentId;
};

// --- dialog state ---
const folderDialog = ref(false);
const folderName = ref("");
const linkDialog = ref(false);
const linkName = ref("");
const linkUrl = ref("");
const renameDialog = ref(false);
const renameTarget = ref<FolderItem | null>(null);
const renameName = ref("");
const renameUrl = ref("");
const moveDialog = ref(false);
const moveTarget = ref<FolderTreeNode | null>(null);
const deleteDialog = ref(false);
const deleteTarget = ref<FolderItem | null>(null);
const previewDialog = ref(false);
const previewNode = ref<FolderTreeNode | null>(null);
const previewSrc = computed(() =>
  previewNode.value ? `/api/files/${previewNode.value.id}/download?inline=1` : "");
const previewKind = computed<"image" | "pdf" | "other">(() => {
  const ct = previewNode.value?.contentType ?? "";
  if (ct.startsWith("image/")) return "image";
  if (ct === "application/pdf") return "pdf";
  return "other";
});

const openPreview = (node: FolderTreeNode) => {
  previewNode.value = node;
  previewDialog.value = true;
};
const uploading = ref(false);
const uploadProgress = ref(0);
const uploadFileName = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

// Target eksplisit dari menu per-folder; undefined = ikut lokasi aktif (selectedFolderId).
const pendingTargetId = ref<number | null | undefined>(undefined);
const effectiveTargetId = computed(() =>
  pendingTargetId.value === undefined ? selectedFolderId.value : pendingTargetId.value);
const targetLabel = computed(() => {
  const id = effectiveTargetId.value;
  if (id === null) return "Akar (/)";
  return items.value.find((i) => i.id === id)?.name ?? "Akar (/)";
});

const openFolderDialog = (node?: FolderTreeNode) => {
  pendingTargetId.value = node ? node.id : undefined;
  folderName.value = "";
  folderDialog.value = true;
};

const openLinkDialog = (node?: FolderTreeNode) => {
  pendingTargetId.value = node ? node.id : undefined;
  linkName.value = "";
  linkUrl.value = "";
  linkDialog.value = true;
};

const findNode = (id: number): FolderTreeNode | null => {
  const walk = (list: FolderTreeNode[]): FolderTreeNode | null => {
    for (const n of list) {
      if (n.id === id) return n;
      const hit = walk(n.children);
      if (hit) return hit;
    }
    return null;
  };
  return walk(tree.value);
};

const submitFolder = async () => {
  const name = folderName.value.trim();
  if (!name) {
    toast.error("Nama folder wajib diisi");
    return;
  }
  try {
    await create({ parentId: effectiveTargetId.value, kind: "folder", name });
    toast.success(`Folder "${name}" dibuat di ${targetLabel.value}`);
    folderDialog.value = false;
    pendingTargetId.value = undefined;
  } catch (err) {
    showError(err, "Gagal membuat folder");
  }
};

const submitLink = async () => {
  const name = linkName.value.trim();
  const url = linkUrl.value.trim();
  if (!name || !url) {
    toast.error("Nama dan URL wajib diisi");
    return;
  }
  try {
    await create({ parentId: effectiveTargetId.value, kind: "link", name, url });
    toast.success(`Link "${name}" ditambahkan ke ${targetLabel.value}`);
    linkDialog.value = false;
    pendingTargetId.value = undefined;
  } catch (err) {
    showError(err, "Gagal menambahkan link");
  }
};

const openRename = (node: FolderTreeNode) => {
  renameTarget.value = node;
  renameName.value = node.name;
  renameUrl.value = node.url ?? "";
  renameDialog.value = true;
};

const submitRename = async () => {
  const target = renameTarget.value;
  if (!target) return;
  const name = renameName.value.trim();
  if (!name) {
    toast.error("Nama wajib diisi");
    return;
  }
  try {
    const body: { name: string; url?: string } = { name };
    if (target.kind === "link" && renameUrl.value.trim()) body.url = renameUrl.value.trim();
    await patchItem(target.id, body);
    toast.success("Perubahan disimpan");
    renameDialog.value = false;
  } catch (err) {
    showError(err, "Gagal menyimpan perubahan");
  }
};

const openMove = (node: FolderTreeNode) => {
  moveTarget.value = node;
  moveDialog.value = true;
};

const submitMove = async (parentId: number | null) => {
  const target = moveTarget.value;
  if (!target) return;
  try {
    await patchItem(target.id, { parentId });
    toast.success(`"${target.name}" dipindahkan`);
  } catch (err) {
    showError(err, "Gagal memindahkan");
  }
};

const openDelete = (node: FolderTreeNode) => {
  deleteTarget.value = node;
  deleteDialog.value = true;
};

const submitDelete = async () => {
  const target = deleteTarget.value;
  if (!target) return;
  try {
    await remove(target.id);
    if (selectedFolderId.value !== null && findNode(selectedFolderId.value) === null) {
      selectedFolderId.value = null;
    }
    toast.success(`"${target.name}" dihapus`);
    deleteDialog.value = false;
  } catch (err) {
    showError(err, "Gagal menghapus");
  }
};

const triggerUpload = (node?: FolderTreeNode) => {
  if (node) pendingTargetId.value = node.id;
  fileInput.value?.click();
};

const onFileChosen = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    pendingTargetId.value = undefined;
    return;
  }
  uploading.value = true;
  uploadProgress.value = 0;
  uploadFileName.value = file.name;
  try {
    await uploadFile(effectiveTargetId.value, file, (pct) => {
      uploadProgress.value = pct;
    });
    uploadProgress.value = 100;
    toast.success(`File "${file.name}" diupload ke ${targetLabel.value}`);
  } catch (err) {
    showError(err, "Gagal upload file");
  } finally {
    uploading.value = false;
    pendingTargetId.value = undefined;
    uploadFileName.value = "";
    input.value = "";
  }
};

onMounted(() => list());
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <div class="mr-auto">
        <h2 class="text-lg font-semibold">Manage folder & file</h2>
        <p class="text-sm text-muted-foreground">
          Lokasi aktif: <span class="font-medium text-foreground">{{ currentPath.join(" / ") }}</span>
          <span v-if="selectedFolderId === null"> — klik folder di tree untuk menjadikannya tujuan</span>
        </p>
      </div>
      <Button variant="outline" size="sm" @click="openFolderDialog()">
        <FolderPlusIcon class="size-4" /> Folder baru
      </Button>
      <Button variant="outline" size="sm" @click="openLinkDialog()">
        <LinkIcon class="size-4" /> Tambah link
      </Button>
      <Button size="sm" :disabled="uploading" @click="triggerUpload()">
        <UploadIcon class="size-4" /> {{ uploading ? `Mengupload… ${uploadProgress}%` : "Upload file" }}
      </Button>
      <input ref="fileInput" type="file" class="hidden" @change="onFileChosen" />
    </div>

    <div v-if="uploading" class="flex flex-col gap-1">
      <p class="text-xs text-muted-foreground">
        Mengirim {{ uploadFileName }} — selesai {{ uploadProgress }}%. Jangan tutup halaman ini.
      </p>
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div class="h-full rounded-full bg-primary transition-all duration-150"
          :style="{ width: `${uploadProgress}%` }" />
      </div>
    </div>

    <Card>
      <CardContent class="p-4">
        <p v-if="loading" class="py-6 text-sm text-muted-foreground">Memuat…</p>
        <p v-else-if="items.length === 0" class="py-6 text-sm text-muted-foreground">
          Belum ada folder atau file. Mulai dengan membuat folder, menambah link, atau upload file.
        </p>
        <div v-else class="flex flex-col">
          <FolderTreeNodeItem v-for="node in tree" :key="node.id" :node="node" :depth="0"
            :selected-id="selectedFolderId" @select="onSelect" @rename="openRename" @move="openMove"
            @remove="openDelete" @add-sub="openFolderDialog" @add-link="openLinkDialog"
            @upload-to="triggerUpload" @preview="openPreview" />
        </div>
      </CardContent>
    </Card>

    <!-- Folder baru -->
    <Dialog v-model:open="folderDialog">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Folder baru</DialogTitle>
          <DialogDescription>Akan dibuat di: {{ targetLabel }}</DialogDescription>
        </DialogHeader>
        <Input v-model="folderName" placeholder="Nama folder" @keyup.enter="submitFolder" />
        <DialogFooter>
          <Button variant="outline" @click="folderDialog = false">Batal</Button>
          <Button @click="submitFolder">Buat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Tambah link -->
    <Dialog v-model:open="linkDialog">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tambah link</DialogTitle>
          <DialogDescription>Akan dibuat di: {{ targetLabel }}</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-3">
          <Input v-model="linkName" placeholder="Nama link" />
          <Input v-model="linkUrl" placeholder="https://…" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="linkDialog = false">Batal</Button>
          <Button @click="submitLink">Tambah</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Rename -->
    <Dialog v-model:open="renameDialog">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ganti nama</DialogTitle>
          <DialogDescription>{{ renameTarget?.kind === "folder" ? "Folder" : renameTarget?.kind === "link" ? "Link" :
            "File" }} akan di-rename.</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-3">
          <Input v-model="renameName" placeholder="Nama" @keyup.enter="submitRename" />
          <Input v-if="renameTarget?.kind === 'link'" v-model="renameUrl" placeholder="URL (https://…)" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="renameDialog = false">Batal</Button>
          <Button @click="submitRename">Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Move -->
    <MoveItemDialog v-model:open="moveDialog" :target="moveTarget" :tree="tree" @move="submitMove" />

    <!-- Preview file -->
    <Dialog v-model:open="previewDialog">
      <DialogContent class="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{{ previewNode?.name }}</DialogTitle>
          <DialogDescription>{{ formatSize(previewNode?.fileSize ?? null) }}</DialogDescription>
        </DialogHeader>
        <div class="flex max-h-[80vh] items-center justify-center overflow-auto">
          <img v-if="previewKind === 'image'" :src="previewSrc" :alt="previewNode?.name ?? ''"
            class="max-h-[72vh] max-w-full object-contain" />
          <iframe v-else-if="previewKind === 'pdf'" :src="previewSrc" class="h-[70vh] w-full rounded-md border"
            title="Preview PDF" />
          <div v-else class="flex flex-col items-center gap-3 py-8 text-center">
            <p class="text-sm text-muted-foreground">
              Preview tidak tersedia untuk tipe ini ({{ previewNode?.contentType ?? "unknown" }}).
            </p>
            <a :href="`/api/files/${previewNode?.id}/download`">
              <Button variant="outline" size="sm">
                <DownloadIcon class="size-4" /> Unduh file
              </Button>
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Delete confirm -->
    <Dialog v-model:open="deleteDialog">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Hapus "{{ deleteTarget?.name }}"?</DialogTitle>
          <DialogDescription>
            <template v-if="deleteTarget?.kind === 'folder'">Folder beserta seluruh isinya (subfolder, link, dan
              file) akan dihapus permanen.</template>
            <template v-else-if="deleteTarget?.kind === 'file'">File di penyimpanan juga akan dihapus.</template>
            <template v-else>Tindakan ini tidak bisa dibatalkan.</template>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="deleteDialog = false">Batal</Button>
          <Button variant="destructive" @click="submitDelete">Hapus</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
