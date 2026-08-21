<script setup lang="ts">
import { LogInIcon, LogOutIcon, LoaderCircleIcon } from "@lucide/vue";
import { useGhAuth } from "~/composables/useGhAuth";

const {
  status,
  dialogOpen,
  busy,
  loginCode,
  loginUrl,
  connect,
  cancelConnect,
  disconnect,
} = useGhAuth();
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
        <!-- Konfirmasi Logout -->
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

        <!-- Device Code OAuth -->
        <template v-else-if="loginCode">
          <DialogHeader>
            <DialogTitle>Login ke GitHub</DialogTitle>
            <DialogDescription>
              Buka link di bawah, masukkan kode sekali pakai ini:
            </DialogDescription>
          </DialogHeader>
          <div class="flex flex-col items-center gap-4 py-4">
            <code class="rounded-lg border bg-muted px-6 py-3 text-2xl font-bold tracking-[0.25em]">
              {{ loginCode }}
            </code>
            <a
              :href="loginUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm text-primary underline-offset-4 hover:underline"
            >
              Buka {{ loginUrl }}
            </a>
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
