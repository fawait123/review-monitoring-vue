<script setup lang="ts">
import { ref, onMounted } from "vue";

const props = defineProps<{
  filePath: string;
  line: number;
  saving?: boolean;
}>();

const emit = defineEmits<{
  save: [body: string];
  cancel: [];
}>();

const body = ref("");
const textareaRef = ref<{ $el?: HTMLTextAreaElement } | HTMLTextAreaElement | null>(null);

onMounted(() => {
  const el = (textareaRef.value as any)?.$el ?? textareaRef.value;
  if (el && typeof el.focus === "function") {
    el.focus();
  }
});

const handleSave = () => {
  if (!body.value.trim()) return;
  emit("save", body.value.trim());
};
</script>

<template>
  <div class="px-4 py-2 bg-background border-t border-border/50">
    <div class="text-xs text-muted-foreground mb-1">
      Komentar @ {{ filePath }}:{{ line }}
    </div>
    <Textarea
      ref="textareaRef"
      v-model="body"
      rows="3"
      placeholder="Tulis komentar review…"
      class="font-sans text-sm"
    />
    <div class="flex justify-end gap-2 mt-2">
      <Button variant="ghost" size="sm" @click="$emit('cancel')">
        Batal
      </Button>
      <Button size="sm" :disabled="saving || !body.trim()" @click="handleSave">
        {{ saving ? "Menyimpan…" : "Simpan" }}
      </Button>
    </div>
  </div>
</template>
