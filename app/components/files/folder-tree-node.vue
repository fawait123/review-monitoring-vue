<script setup lang="ts">
import { ref } from "vue";
import {
  ChevronRightIcon,
  DownloadIcon,
  EyeIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  LinkIcon,
  MoreVerticalIcon,
} from "@lucide/vue";
import type { FolderTreeNode } from "~~/shared/types";

defineOptions({ name: "FolderTreeNode" });

const props = defineProps<{
  node: FolderTreeNode;
  depth: number;
  selectedId: number | null;
}>();

const emit = defineEmits<{
  select: [node: FolderTreeNode];
  rename: [node: FolderTreeNode];
  move: [node: FolderTreeNode];
  remove: [node: FolderTreeNode];
  addSub: [node: FolderTreeNode];
  addLink: [node: FolderTreeNode];
  uploadTo: [node: FolderTreeNode];
  preview: [node: FolderTreeNode];
}>();

const open = ref(props.node.kind === "folder");

const isFolder = () => props.node.kind === "folder";
const isSelected = () => props.node.id === props.selectedId;

const onRowClick = () => {
  if (isFolder()) {
    open.value = !open.value;
    emit("select", props.node);
  }
};
</script>

<template>
  <div>
    <div class="group flex items-center gap-1 rounded-md py-1 pr-1 transition-colors hover:bg-muted"
      :class="isSelected() && 'bg-muted'" :style="{ paddingLeft: `${depth * 20 + 8}px` }">

      <template v-if="isFolder()">
        <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left text-sm" @click="onRowClick">
          <ChevronRightIcon class="size-4 shrink-0 text-muted-foreground transition-transform"
            :class="open && 'rotate-90'" />
          <FolderOpenIcon v-if="open" class="size-4 shrink-0 text-muted-foreground" />
          <FolderIcon v-else class="size-4 shrink-0 text-muted-foreground" />
          <span class="truncate font-medium">{{ node.name }}</span>
        </button>
      </template>

      <template v-else-if="node.kind === 'link'">
        <a :href="node.url ?? '#'" target="_blank" rel="noopener"
          class="flex min-w-0 flex-1 items-center gap-2 text-sm text-foreground hover:text-brand">
          <span class="w-4 shrink-0" />
          <LinkIcon class="size-4 shrink-0 text-muted-foreground" />
          <span class="truncate">{{ node.name }}</span>
          <span class="truncate text-xs text-muted-foreground">
            {{ String(node.url).length > 106 ? String(node.url).slice(0, 106) + '...' : node.url }}
          </span>
        </a>
      </template>

      <template v-else>
        <div class="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span class="w-4 shrink-0" />
          <FileIcon class="size-4 shrink-0 text-muted-foreground" />
          <span class="truncate">{{ node.name }}</span>
          <Badge variant="secondary" class="shrink-0 text-xs">{{ formatSize(node.fileSize) }}</Badge>
          <Button variant="ghost" size="icon" class="size-7 shrink-0" title="Lihat" @click="emit('preview', node)">
            <EyeIcon class="size-4" />
          </Button>
          <a :href="`/api/files/${node.id}/download`" class="shrink-0" title="Unduh">
            <Button variant="ghost" size="icon" class="size-7">
              <DownloadIcon class="size-4" />
            </Button>
          </a>
        </div>
      </template>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" class="size-7 opacity-0 transition-opacity group-hover:opacity-100">
            <MoreVerticalIcon class="size-4" />
            <span class="sr-only">Aksi untuk {{ node.name }}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <template v-if="node.kind === 'file'">
            <DropdownMenuItem @click="emit('preview', node)">Lihat file</DropdownMenuItem>
            <DropdownMenuSeparator />
          </template>
          <template v-if="isFolder()">
            <DropdownMenuItem @click="emit('addSub', node)">Sub-folder baru</DropdownMenuItem>
            <DropdownMenuItem @click="emit('addLink', node)">Tambah link di sini</DropdownMenuItem>
            <DropdownMenuItem @click="emit('uploadTo', node)">Upload file ke sini</DropdownMenuItem>
            <DropdownMenuSeparator />
          </template>
          <DropdownMenuItem @click="emit('rename', node)">Ganti nama</DropdownMenuItem>
          <DropdownMenuItem @click="emit('move', node)">Pindahkan ke…</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="text-destructive" @click="emit('remove', node)">Hapus</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div v-if="isFolder() && open">
      <FolderTreeNode v-for="child in node.children" :key="child.id" :node="child" :depth="depth + 1"
        :selected-id="selectedId" @select="(n) => emit('select', n)" @rename="(n) => emit('rename', n)"
        @move="(n) => emit('move', n)" @remove="(n) => emit('remove', n)" @add-sub="(n) => emit('addSub', n)"
        @add-link="(n) => emit('addLink', n)" @upload-to="(n) => emit('uploadTo', n)"
        @preview="(n) => emit('preview', n)" />
    </div>
  </div>
</template>
