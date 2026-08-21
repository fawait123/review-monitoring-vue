import { ref, watch, onMounted, onUnmounted } from "vue";
import { toast } from "vue-sonner";

export interface GhStatus {
  installed: boolean;
  authenticated: boolean;
  login: string | null;
}

export function useGhAuth() {
  const status = ref<GhStatus | null>(null);
  const dialogOpen = ref(false);
  const busy = ref(false);
  const loginCode = ref<string | null>(null);
  const loginUrl = ref("https://github.com/login/device");

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function refreshStatus() {
    try {
      status.value = await $fetch<GhStatus>("/api/gh/status");
    } catch {
      // server mati / offline — pertahankan state
    }
  }

  watch(dialogOpen, (open) => {
    if (open && !status.value?.authenticated) {
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

  async function connect() {
    busy.value = true;
    try {
      const data = await $fetch<{ code: string; url: string }>("/api/gh/connect", {
        method: "POST",
      });
      loginCode.value = data.code;
      loginUrl.value = data.url;
      dialogOpen.value = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memulai login";
      toast.error(msg);
    } finally {
      busy.value = false;
    }
  }

  async function cancelConnect() {
    try {
      await $fetch("/api/gh/connect", { method: "DELETE" });
    } catch {
      // ignore
    }
    loginCode.value = null;
    dialogOpen.value = false;
    await refreshStatus();
  }

  async function disconnect() {
    busy.value = true;
    try {
      await $fetch("/api/gh/disconnect", { method: "POST" });
      toast.success("Berhasil logout dari GitHub");
      dialogOpen.value = false;
      await refreshStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Logout gagal";
      toast.error(msg);
    } finally {
      busy.value = false;
    }
  }

  onMounted(refreshStatus);
  onUnmounted(stopPoll);

  return {
    status,
    dialogOpen,
    busy,
    loginCode,
    loginUrl,
    refreshStatus,
    connect,
    cancelConnect,
    disconnect,
  };
}
