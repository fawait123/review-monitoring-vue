<script setup lang="ts">
import { toast } from "vue-sonner";
import { LogInIcon, LogOutIcon, LoaderCircleIcon } from "@lucide/vue";

interface GhStatus {
  installed: boolean;
  authenticated: boolean;
  login: string | null;
}

const status = ref<GhStatus | null>(null);
const dialogOpen = ref(false);
const busy = ref(false);
const loginCode = ref<string | null>(null);
const loginUrl = ref("https://github.com/login/device");

async function refreshStatus() {
  try {
    const res = await fetch("/api/gh/status");
    status.value = await res.json();
  } catch {
    // server mati — biarkan state lama
  }
}
onMounted(refreshStatus);

let pollTimer: ReturnType<typeof setInterval> | null = null;
function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
watch(dialogOpen, (open) => {
  if (open && !status.value?.authenticated) {
    // polling sampai user selesai authorize di browser
    pollTimer = setInterval(async () => {
      await refreshStatus();
      if (status.value?.authenticated) {
        stopPoll();
        dialogOpen.value = false;
        toast.success(`Login berhasil: @${status.value.login}`);
      }
    }, 2000);
  } else {
    stopPoll();
  }
});
onUnmounted(stopPoll);

async function connect() {
  busy.value = true;
  try {
    const res = await fetch("/api/gh/connect", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Gagal memulai login");
    loginCode.value = data.code;
    loginUrl.value = data.url;
    dialogOpen.value = true;
  } catch (err: any) {
    toast.error(err.message);
  } finally {
    busy.value = false;
  }
}

async function cancelConnect() {
  await fetch("/api/gh/connect", { method: "DELETE" });
  loginCode.value = null;
  dialogOpen.value = false;
  await refreshStatus();
}

async function disconnect() {
  busy.value = true;
  try {
    const res = await fetch("/api/gh/disconnect", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Logout gagal");
    toast.success("Berhasil logout dari GitHub");
    dialogOpen.value = false;
    await refreshStatus();
  } catch (err: any) {
    toast.error(err.message);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <Button
      variant="ghost"
      size="sm"
      class="gap-2 text-xs text-muted-foreground hover:text-foreground"
      :disabled="busy || !status || !status.installed"
      @click="status?.authenticated ? (dialogOpen = true) : connect()"
    >
      <LoaderCircleIcon v-if="!status" class="size-3 animate-spin" />
      <template v-else>
        <span
          class="inline-block size-2 rounded-full"
          :class="status.authenticated ? 'bg-emerald-400' : 'bg-zinc-400'"
        />
        <LogInIcon v-if="!status.authenticated" class="size-3.5" />
        <span v-if="!status.installed">gh tidak terpasang</span>
        <span v-else-if="status.authenticated">gh: @{{ status.login }}</span>
        <span v-else>Connect GitHub</span>
      </template>
    </Button>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-md">
        <!-- konfirmasi logout -->
        <template v-if="status?.authenticated">
          <DialogHeader>
            <DialogTitle>Logout dari GitHub?</DialogTitle>
            <DialogDescription>
              Akun <span class="font-medium">@{{ status.login }}</span> akan diputus dari gh CLI. PR dan repo yang sudah
              tersimpan tidak terhapus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="dialogOpen = false">Batal</Button>
            <Button variant="destructive" :disabled="busy" @click="disconnect">
              <LogOutIcon v-if="!busy" class="size-4" />
              <LoaderCircleIcon v-else class="size-4 animate-spin" />
              {{ busy ? "Memutus..." : "Logout" }}
            </Button>
          </DialogFooter>
        </template>

        <!-- device code -->
        <template v-else-if="loginCode">
          <DialogHeader>
            <DialogTitle>Login ke GitHub</DialogTitle>
            <DialogDescription>
              Buka link di bawah, masukkan kode sekali pakai ini:
            </DialogDescription>
          </DialogHeader>
          <div class="flex flex-col items-center gap-4 py-4">
            <code
              class="rounded-lg border bg-muted px-6 py-3 text-2xl font-bold tracking-[0.25em]"
            >{{ loginCode }}</code>
            <a
              :href="loginUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm text-primary underline-offset-4 hover:underline"
            >Buka {{ loginUrl }}</a>
            <span class="flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircleIcon class="size-3 animate-spin" />
              Menunggu otorisasi di browser...
            </span>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="cancelConnect">Batal</Button>
          </DialogFooter>
        </template>
      </DialogContent>
    </Dialog>
  </div>
</template>
